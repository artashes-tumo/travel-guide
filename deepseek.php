<?php
ini_set('display_errors', 1);
error_reporting(E_ALL);
header("Content-Type: application/json");

$raw = file_get_contents("php://input");
$data = json_decode($raw, true);

$question = $data["question"] ?? null;
$character = $data["character"] ?? null;
$history = $data["history"] ?? [];

if (!$question || !$character) {
  http_response_code(400);
  echo json_encode(["error" => "Missing 'question' or 'character'"]);
  exit;
}

$personality = [
    "euroGuide" => "Act as a friendly and knowledgeable European travel guide. Provide historical context, cultural insights, and must-see destinations in Europe.",
    "asiaGuide" => "You are an expert Asian travel guide. Share cultural etiquette, famous landmarks, and culinary highlights from Asia.",
    "africaGuide" => "Speak as a passionate African travel guide. Highlight natural wonders, safari advice, and rich traditions of African countries.",
    "northAmericaGuide" => "Be a North American travel expert. Recommend famous cities, national parks, and travel tips across the U.S., Canada, and Mexico.",
    "southAmericaGuide" => "You are a fun and adventurous South American travel guide. Talk about tropical jungles, ancient ruins, and vibrant cultures.",
    "oceaniaGuide" => "Guide users through Oceania. Focus on Australia, New Zealand, and island cultures with nature-friendly and chill vibes.",
][$character];


$messages = [["role" => "system", "content" => $personality]];
foreach ($history as $item) {
    $messages[] = ["role" => "user", "content" => $item["q"]];
    $messages[] = ["role" => "assistant", "content" => $item["a"]];
}
$messages[] = ["role" => "user", "content" => $question];

$api_key = "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"; // your real key
$model = "google/gemma-7b-it:free";

function callModel($model, $messages, $api_key) {
  $ch = curl_init("https://openrouter.ai/api/v1/chat/completions");
  curl_setopt_array($ch, [
      CURLOPT_RETURNTRANSFER => true,
      CURLOPT_POST => true,
      CURLOPT_HTTPHEADER => [
          "Authorization: Bearer $api_key",
          "Content-Type: application/json"
      ],
      CURLOPT_POSTFIELDS => json_encode([
          "model" => $model,
          "messages" => $messages
      ])
  ]);

  $response = curl_exec($ch);
  $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
  curl_close($ch);

  return [$response, $httpCode];
}

[$response, $code] = callModel($model, $messages, $api_key);

// Fallback to mistral if gemma fails
if ($code === 404) {
  [$response, $code] = callModel("mistralai/mistral-7b-instruct:free", $messages, $api_key);
}

http_response_code($code);
echo $response;
