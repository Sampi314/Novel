const isDev = import.meta.env.DEV;

export async function writeFile(filePath, content) {
  if (isDev) {
    const res = await fetch('/api/write-file', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ filePath, content }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to write file');
    }
    return;
  }
  // Production fallback: download
  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filePath.split('/').pop();
  a.click();
  URL.revokeObjectURL(url);
}

export async function uploadAudio(filePath, file) {
  if (isDev) {
    const arrayBuffer = await file.arrayBuffer();
    const res = await fetch('/api/upload-audio', {
      method: 'POST',
      headers: {
        'Content-Type': file.type || 'application/octet-stream',
        'x-file-path': filePath,
      },
      body: arrayBuffer,
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to upload audio');
    }
    return;
  }
  // Production fallback: download
  const url = URL.createObjectURL(file);
  const a = document.createElement('a');
  a.href = url;
  a.download = filePath.split('/').pop();
  a.click();
  URL.revokeObjectURL(url);
}
