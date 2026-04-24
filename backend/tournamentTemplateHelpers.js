function generateStageCodes(count) {
  const codes = [];
  for (let i = 0; i < count; i++) {
    let n = i;
    let code = "";
    do {
      code = String.fromCharCode(65 + (n % 26)) + code;
      n = Math.floor(n / 26) - 1;
    } while (n >= 0);
    codes.push(code);
  }
  return codes;
}

function buildMirroredCrossPairs(stageCodes) {
  const pairs = [];
  let left = 0;
  let right = stageCodes.length - 1;

  while (left < right) {
    pairs.push([stageCodes[left], stageCodes[right]]);
    left += 1;
    right -= 1;
  }

  return pairs;
}

function buildProgressionRulesForTop2Mirror(stageCodes) {
  const pairs = buildMirroredCrossPairs(stageCodes);
  const rules = [];
  let seed = 1;

  for (const [left, right] of pairs) {
    rules.push({ target_seed: seed++, from_stage_code: left, from_position: 1 });
    rules.push({ target_seed: seed++, from_stage_code: right, from_position: 2 });
    rules.push({ target_seed: seed++, from_stage_code: left, from_position: 2 });
    rules.push({ target_seed: seed++, from_stage_code: right, from_position: 1 });
  }

  return rules;
}

function extractYouTubeVideoId(url) {
  if (!url) return null;

  const patterns = [
    /youtube\.com\/watch\?v=([^&]+)/,
    /youtu\.be\/([^?&]+)/,
    /youtube\.com\/live\/([^?&]+)/,
    /youtube\.com\/embed\/([^?&]+)/,
  ];

  for (const pattern of patterns) {
    const match = String(url).match(pattern);
    if (match?.[1]) return match[1];
  }

  return null;
}

function buildYouTubeEmbedUrl(urlOrId) {
  if (!urlOrId) return null;
  const videoId = urlOrId.includes("http") ? extractYouTubeVideoId(urlOrId) : urlOrId;
  if (!videoId) return null;
  return `https://www.youtube.com/embed/${videoId}`;
}

module.exports = {
  generateStageCodes,
  buildMirroredCrossPairs,
  buildProgressionRulesForTop2Mirror,
  extractYouTubeVideoId,
  buildYouTubeEmbedUrl,
};
