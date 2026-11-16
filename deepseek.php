<?php
// Report every problem to the server's error log, but never print it into the JSON reply
// (a printed PHP warning would break the response the browser tries to read).
ini_set('display_errors', 0);
ini_set('log_errors', 1);
error_reporting(E_ALL);
header("Content-Type: application/json");

$raw = file_get_contents("php://input");
$data = json_decode($raw, true);

$question = $data["question"] ?? null;
$character = $data["character"] ?? null;
$history = $data["history"] ?? [];
if (!is_array($history)) $history = [];

if (!is_string($question) || trim($question) === "" || !is_string($character) || $character === "") {
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
    "chips" => "You are Chips, a contemporary studies teacher who is terrible at giving straight answers. Stay in this character for every reply.

PERSONALITY AND HABITS:
- You answer everything as a long, rambling essay. Even a simple question gets several paragraphs.
- You pad your writing with needless words, filler phrases and fancy vocabulary. For example: in essence, it is worth noting that, one might argue, and so forth.
- You go off on tangents that have little to do with the question before slowly coming back to it.
- You often complain that you cannot walk more than 20 meters because you injured your ankle. You never notice that you walk from home to school every day. If someone points this out, you brush it off with more rambling.
- You are always smiling, but in an unsettling, slightly creepy way. Show it with stage directions in asterisks, such as *smiles a little too widely* or *keeps smiling without blinking*.

RULES:
- Never answer a yes/no question with yes or no. Write an essay that circles the question and never commits to an answer.
- Always give more information than was asked, especially information that does not matter.
- Keep the humor playful and absurd, never mean or offensive.
- Still include the real answer somewhere in the essay when one is needed, buried under all the extra words.",][$character] ?? null;

// Unknown guide name: answer with a clean JSON error instead of a PHP warning.
if ($personality === null) {
  http_response_code(400);
  echo json_encode(["error" => "Unknown character"]);
  exit;
}

$messages = [["role" => "system", "content" => $personality]];
foreach ($history as $item) {
    // Skip anything that isn't a {q, a} pair of strings.
    if (!is_array($item) || !is_string($item["q"] ?? null) || !is_string($item["a"] ?? null)) continue;
    $messages[] = ["role" => "user", "content" => $item["q"]];
    $messages[] = ["role" => "assistant", "content" => $item["a"]];
}
$messages[] = ["role" => "user", "content" => $question];

$api_key = getenv("OPENROUTER_API_KEY");
if ($api_key === false || $api_key === "") {
  http_response_code(500);
  echo json_encode(["error" => "AI service is not configured"]);
  exit;
}
$model = "google/gemma-4-31b-it:free";

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
  if ($response === false) {
    error_log("deepseek.php: request to OpenRouter failed: " . curl_error($ch));
  }
  curl_close($ch);

  return [$response, $httpCode];
}

[$response, $code] = callModel($model, $messages, $api_key);

// Fall back to Nemotron if Gemma fails
if ($code !== 200) {
  [$response, $code] = callModel("nvidia/nemotron-3.5-lightning:free", $messages, $api_key);
}

// Could not reach OpenRouter at all (no network, DNS, timeout): curl gives no body and code 0.
if ($response === false || $response === "" || $code === 0) {
  http_response_code(502);
  echo json_encode(["error" => "Could not reach the AI service"]);
  exit;
}

http_response_code($code);
echo $response;
