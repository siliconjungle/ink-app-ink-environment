# Ink Environment

Edit and compile Ink programs, select functions, provide exact JSON inputs, run programs and inspect diagnostics, timings and generated code.

## Install

Requires a running [Ink OS](https://github.com/siliconjungle/ink-os-platform) instance and its `ink-os` CLI. Use Node.js 24 or later for development.

```sh
git clone https://github.com/siliconjungle/ink-app-ink-environment.git
cd ink-app-ink-environment
npm test
# Select your Ink instance using its CLI connection profile.
ink-os deploy .
```

The CLI deploys committed source from your checkout. Commit any edits before deploying them. No credentials or personal instance configuration belong in this repository.

## Behaviour and limits

JavaScript runs in a worker. WebGPU requires a compatible device; native Rust/Wasm builds use the Ink CLI. Source drafts and explicit file saves integrate with Ink storage.

## Development

`npm run dev` opens a local development server. Preview fixtures are separate from live Ink data.

## License

MIT for app code. Bundled third-party components retain their own licenses and notices.
