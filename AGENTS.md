# Project automation guardrails

- Never launch Vite, npm, Electron, or game servers with `Start-Process`, detached processes, background jobs, or commands intended to stay alive.
- Do not use `npm run dev` for automated verification. It is a persistent server and can leave the task waiting indefinitely.
- Verify character-creation work with `npm run verify:character-creation`. This command must remain one-shot and exit by itself.
- Use `npm run electron:dist` only in the foreground when a packaged Windows build is required.
- If browser-only verification is necessary, create a bounded one-shot harness with explicit startup, timeout, and cleanup in the same process before running it.
