<?php
// File: api.php
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Headers: Content-Type");
header("Content-Type: application/json");

// Supabase Credentials (এখানে আপনার গুলো বসাবেন, এগুলো কেউ দেখতে পারবে না)
$SUPABASE_URL = 'https://aaqzjogybhzhoteabfsu.supabase.co'; 
$SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFhcXpqb2d5Ymh6aG90ZWFiZnN1Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MTUxMzY1NywiZXhwIjoyMDk3MDg5NjU3fQ.7sMQPR7BLLaPF-Wwasn7rdgHRwb2h2mna43ru8GzQds';

// Helper Function for Supabase REST API
function supabase($endpoint, $method = 'GET', $data = null) {
    global $SUPABASE_URL, $SUPABASE_KEY;
    $url = $SUPABASE_URL . '/rest/v1/' . $endpoint;
    
    $ch = curl_init($url);
    $headers = [
        "apikey: " . $SUPABASE_KEY,
        "Authorization: Bearer " . $SUPABASE_KEY,
        "Content-Type: application/json",
        "Prefer: return=representation" // Returns data after insert/update
    ];
    
    if ($method == 'POST') {
        curl_setopt($ch, CURLOPT_POST, true);
        if ($data) curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($data));
    } else if ($method == 'PATCH') {
        curl_setopt($ch, CURLOPT_CUSTOMREQUEST, 'PATCH');
        if ($data) curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($data));
    }
    
    curl_setopt($ch, CURLOPT_HTTPHEADER, $headers);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    
    $response = curl_exec($ch);
    curl_close($ch);
    return json_decode($response, true);
}

// Get the Action from URL (e.g. api.php?action=init)
$action = $_GET['action'] ?? '';
$input = json_decode(file_get_contents('php://input'), true);

if ($action == 'init') {
    $user = $input['user'];
    $start_param = $input['start_param'] ?? null;
    $telegram_id = $user['id'];

    // 1. Check if user exists
    $userData = supabase("users?telegram_id=eq.$telegram_id");
    
    if (empty($userData)) {
        // Create new user
        $newUser = [
            'telegram_id' => $telegram_id,
            'first_name' => $user['first_name'],
            'photo_url' => $user['photo_url'] ?? '',
            'referred_by' => is_numeric($start_param) ? intval($start_param) : null
        ];
        $userData = supabase("users", "POST", $newUser);
    }
    
    // 2. Get Settings
    $settingsData = supabase("settings?id=eq.1");
    $settings = $settingsData[0];
    
    // **Security:** Remove bot_token before sending to frontend so hackers can't see it
    unset($settings['bot_token']); 

    // 3. Get Tasks
    $allTasks = supabase("tasks");
    $completedTasks = supabase("user_tasks?select=task_id&user_id=eq.$telegram_id");
    
    $completedIds = array_column($completedTasks, 'task_id');
    $availableTasks = array_filter($allTasks, function($task) use ($completedIds) {
        return !in_array($task['id'], $completedIds);
    });

    echo json_encode([
        'user' => $userData[0],
        'settings' => $settings,
        'tasks' => array_values($availableTasks)
    ]);
}

elseif ($action == 'verify-task') {
    $telegram_id = $input['telegram_id'];
    $task_id = $input['task_id'];
    $channel_id = $input['channel_id'];
    $reward = $input['reward'];

    // Fetch bot_token from DB dynamically
    $settings = supabase("settings?id=eq.1")[0];
    $botToken = $settings['bot_token'];

    // Check with Telegram API
    $tgApiUrl = "https://api.telegram.org/bot$botToken/getChatMember?chat_id=$channel_id&user_id=$telegram_id";
    $tgResponse = json_decode(file_get_contents($tgApiUrl), true);
    
    if (isset($tgResponse['result']['status']) && in_array($tgResponse['result']['status'], ['member', 'administrator', 'creator'])) {
        
        // Insert completed task
        supabase("user_tasks", "POST", ['user_id' => $telegram_id, 'task_id' => $task_id]);
        
        // Update user balance
        $userData = supabase("users?telegram_id=eq.$telegram_id")[0];
        $newBalance = $userData['balance'] + $reward;
        supabase("users?telegram_id=eq.$telegram_id", "PATCH", ['balance' => $newBalance]);

        echo json_encode(['success' => true, 'message' => 'টাস্ক সফলভাবে সম্পন্ন হয়েছে!']);
    } else {
        echo json_encode(['success' => false, 'message' => 'আপনি এখনো চ্যানেলে জয়েন করেননি!']);
    }
}

elseif ($action == 'watch-ad') {
    $telegram_id = $input['telegram_id'];

    $settings = supabase("settings?id=eq.1")[0];
    $userData = supabase("users?telegram_id=eq.$telegram_id")[0];

    if ($userData['daily_ads_watched'] >= $settings['daily_ad_limit']) {
        echo json_encode(['success' => false, 'message' => 'আজকের অ্যাড দেখার লিমিট শেষ!']);
        exit;
    }

    $updateData = [
        'balance' => $userData['balance'] + $settings['ad_reward'],
        'total_ads_watched' => $userData['total_ads_watched'] + 1,
        'daily_ads_watched' => $userData['daily_ads_watched'] + 1
    ];

    supabase("users?telegram_id=eq.$telegram_id", "PATCH", $updateData);
    echo json_encode(['success' => true, 'message' => 'অ্যাড দেখা সফল হয়েছে! ব্যালেন্স যুক্ত করা হয়েছে।']);
}

elseif ($action == 'withdraw') {
    $telegram_id = $input['telegram_id'];
    $amount = floatval($input['amount']);
    $method = $input['method'];
    $number = $input['number'];

    $settings = supabase("settings?id=eq.1")[0];
    $userData = supabase("users?telegram_id=eq.$telegram_id")[0];

    if ($userData['total_ads_watched'] < $settings['min_ads_for_withdraw']) {
        echo json_encode(['success' => false, 'message' => "সর্বনিম্ন {$settings['min_ads_for_withdraw']} টি অ্যাড দেখতে হবে!"]);
        exit;
    }
    if ($amount < $settings['min_withdraw']) {
        echo json_encode(['success' => false, 'message' => "মিনিমাম উইথড্র ৳{$settings['min_withdraw']}"]);
        exit;
    }
    if ($userData['balance'] < $amount) {
        echo json_encode(['success' => false, 'message' => 'পর্যাপ্ত ব্যালেন্স নেই!']);
        exit;
    }

    // Deduct Balance
    $newBalance = $userData['balance'] - $amount;
    supabase("users?telegram_id=eq.$telegram_id", "PATCH", ['balance' => $newBalance]);

    // Insert Withdrawal Record
    supabase("withdrawals", "POST", [
        'user_id' => $telegram_id,
        'method' => $method,
        'account_number' => $number,
        'amount' => $amount
    ]);

    echo json_encode(['success' => true, 'message' => 'উত্তোলনের রিকোয়েস্ট সফলভাবে জমা হয়েছে!']);
}
?>
