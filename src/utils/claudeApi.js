const API_URL = 'https://api.anthropic.com/v1/messages';
const MODEL = 'claude-sonnet-4-6';

export function getApiKey() {
  return localStorage.getItem('cng-api-key') || '';
}

export function setApiKey(key) {
  localStorage.setItem('cng-api-key', key);
}

export async function callClaude({ systemPrompt, userMessage, maxTokens = 4096 }) {
  const apiKey = getApiKey();
  if (!apiKey) throw new Error('Chưa có API key. Vui lòng nhập Anthropic API key.');

  const response = await fetch(API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: maxTokens,
      system: systemPrompt,
      messages: [{ role: 'user', content: userMessage }],
    }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error?.message || `API error: ${response.status}`);
  }

  const data = await response.json();
  const text = data.content?.[0]?.text || '';
  return parseJsonResponse(text);
}

export async function callClaudeText({ systemPrompt, userMessage, maxTokens = 4096 }) {
  const apiKey = getApiKey();
  if (!apiKey) throw new Error('Chưa có API key. Vui lòng nhập Anthropic API key.');

  const response = await fetch(API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: maxTokens,
      system: systemPrompt,
      messages: [{ role: 'user', content: userMessage }],
    }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error?.message || `API error: ${response.status}`);
  }

  const data = await response.json();
  return data.content?.[0]?.text || '';
}

function parseJsonResponse(text) {
  let cleaned = text.trim();
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```(?:json)?\s*/, '').replace(/\s*```$/, '');
  }
  try {
    return JSON.parse(cleaned);
  } catch (e) {
    throw new Error('Không thể phân tích phản hồi từ AI. Vui lòng thử lại.');
  }
}
