import Script from 'next/script';

export function ErrorLogBootstrap() {
  const script = `
    (() => {
      if (window.__robbinsErrorLoggerInstalled) return;
      window.__robbinsErrorLoggerInstalled = true;
      const ignoreLoggingFailure = (error) => {
        void error;
      };

      const send = (payload) => {
        try {
          const body = JSON.stringify({
            ...payload,
            url: location.href,
            userAgent: navigator.userAgent,
            timestamp: new Date().toISOString()
          });

          if (navigator.sendBeacon) {
            navigator.sendBeacon('/api/log', new Blob([body], {type: 'application/json'}));
            return;
          }

          fetch('/api/log', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body,
            keepalive: true
          }).catch(ignoreLoggingFailure);
        } catch (error) {
          ignoreLoggingFailure(error);
        }
      };

      window.addEventListener('error', (event) => {
        send({
          type: 'window.error',
          message: event.message,
          source: event.filename,
          line: event.lineno,
          column: event.colno,
          stack: event.error && event.error.stack
        });
      });

      window.addEventListener('unhandledrejection', (event) => {
        const reason = event.reason;
        send({
          type: 'window.unhandledrejection',
          message: reason && reason.message ? reason.message : String(reason),
          stack: reason && reason.stack
        });
      });

      const originalError = console.error;
      console.error = (...args) => {
        send({
          type: 'console.error',
          message: args.map((arg) => {
            if (arg instanceof Error) return arg.message;
            if (typeof arg === 'string') return arg;
            try { return JSON.stringify(arg); } catch { return String(arg); }
          }).join(' '),
          stack: args.find((arg) => arg instanceof Error)?.stack
        });
        originalError.apply(console, args);
      };
    })();
  `;

  return <Script id="robbins-error-logger" strategy="afterInteractive" dangerouslySetInnerHTML={{__html: script}} />;
}
