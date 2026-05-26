# TODO

## Peer dependency conflict fix (build failure)
- [x] Diagnose: found `@emoji-mart/react@1.1.1` peers React 16/17/18 only.
- [x] Verified `@emoji-mart/react@latest` is `1.1.1` and `1.2.0` doesn’t exist in npm.
- [x] Update `package.json`: downgrade `react` and `react-dom` to `^18.3.1`.
- [x] Clean reinstall: removed `node_modules` + deleted `package-lock.json`, then ran `npm install`.
- [x] Verify: `npm run build` succeeds.

