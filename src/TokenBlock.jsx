import { useEffect, useState } from 'react';

const STATUS_TEXT = { copied: 'Copied', failed: "Couldn't copy" };

function CopyIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
      <rect x="5.5" y="5.5" width="8" height="9" rx="1.5" />
      <path d="M10.5 3.5v-1a1 1 0 0 0-1-1h-6a1 1 0 0 0-1 1v8a1 1 0 0 0 1 1h1" />
    </svg>
  );
}

// A raw token with a button that copies it to the clipboard.
function TokenBlock({ title, token }) {
  const [status, setStatus] = useState(null);

  useEffect(() => {
    if (!status) return;
    const timer = setTimeout(() => setStatus(null), 2000);
    return () => clearTimeout(timer);
  }, [status]);

  async function copy() {
    try {
      await navigator.clipboard.writeText(token);
      setStatus('copied');
    } catch {
      setStatus('failed');
    }
  }

  return (
    <div className="token-block">
      <div className="token-block-header">
        <h3>{title}</h3>
        <button type="button" className="icon-button" onClick={copy} title={`Copy ${title.toLowerCase()}`} aria-label={`Copy ${title.toLowerCase()}`}>
          <CopyIcon />
        </button>
        <span role="status">{STATUS_TEXT[status]}</span>
      </div>
      <pre className="pre-block token-value">{token}</pre>
    </div>
  );
}

export default TokenBlock;
