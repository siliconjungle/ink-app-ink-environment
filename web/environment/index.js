//#region src/bundles.ts
async function e(e) {
	if (!("serviceWorker" in navigator)) throw Error("This browser needs service workers to load locally compiled Ink bundles.");
	await navigator.serviceWorker.register(new URL("environment-sw.js", e), { scope: e }), await navigator.serviceWorker.ready, navigator.serviceWorker.controller || await new Promise((e, t) => {
		let n = setTimeout(() => t(Error("Reload once to enable the local bundle loader.")), 1e4);
		navigator.serviceWorker.addEventListener("controllerchange", () => {
			clearTimeout(n), e();
		}, { once: !0 });
	});
}
//#endregion
//#region src/client.ts
var t = class {
	url;
	progress;
	worker;
	sequence = 0;
	pending = /* @__PURE__ */ new Map();
	constructor(e, t = () => {}) {
		this.url = e, this.progress = t;
	}
	request(e) {
		this.worker || (this.worker = new Worker(new URL(
			/* @vite-ignore */
			new URL("assets/compiler-worker-o7jMrHsf.js", import.meta.url).href,
			"" + import.meta.url
		), { type: "module" }), this.worker.onmessage = ({ data: e }) => {
			let t = this.pending.get(e.id);
			t && (e.progress ? this.progress(e.progress) : (clearTimeout(t.timer), this.pending.delete(e.id), e.error ? t.reject(Error(e.error)) : t.resolve(e)));
		}, this.worker.onerror = (e) => this.stop(e.message || "Compiler worker failed."));
		let t = ++this.sequence;
		return new Promise((n, r) => {
			let i = setTimeout(() => this.stop("Compilation/validation exceeded 180 seconds. Reduce this program or input."), 18e4);
			this.pending.set(t, {
				resolve: n,
				reject: r,
				timer: i
			}), this.worker.postMessage({
				id: t,
				compilerUrl: this.url,
				request: e
			});
		});
	}
	async compile(e, t) {
		let n = await this.request({
			op: "compile",
			source: e,
			...t === void 0 ? {} : { contractEvidence: t }
		});
		return {
			...n.ok,
			compileMs: n.elapsedMs,
			compilerLoadMs: n.loadMs
		};
	}
	async prepare(e, t, n) {
		let r = await this.request({
			op: "prepare",
			core: e.core,
			identity: e.manifest.core_sha256,
			entry: t,
			input: n
		});
		return {
			input: r.ok.input,
			validationMs: r.elapsedMs
		};
	}
	stop(e = "Stopped.") {
		this.worker?.terminate(), this.worker = void 0;
		for (let t of this.pending.values()) clearTimeout(t.timer), t.reject(Error(e));
		this.pending.clear();
	}
}, n = class {
	cleanup;
	constructor(e) {}
	run(e, t, n, r, i, a = {}) {
		this.stop();
		let o = new Worker(new URL(
			/* @vite-ignore */
			new URL("assets/run-worker-DsDMPs6t.js", import.meta.url).href,
			"" + import.meta.url
		), { type: "module" });
		return new Promise((s, c) => {
			let l = (e, t) => {
				clearTimeout(u), o.terminate(), this.cleanup = void 0, e ? c(e) : s(t);
			}, u = setTimeout(() => l(Error("Run exceeded 120 seconds. Reduce the workload.")), 12e4);
			this.cleanup = () => l(Error("Stopped.")), o.onmessage = ({ data: e }) => {
				e.progress ? i(e.progress) : l(e.error ? Error(e.error) : null, e.ok);
			}, o.onerror = (e) => l(Error(e.message || "Execution worker failed.")), o.postMessage({
				artifact: e,
				entry: t,
				input: n,
				benchmark: r,
				settings: a
			});
		});
	}
	stop() {
		this.cleanup?.();
	}
}, r = [
	{
		id: "adaptive",
		name: "Pipeline · three stages, fixed placement",
		entry: "@pipeline",
		source: "module Adaptive;\n\nfn heavy(xs: List<u32>) -> List<u32> {\n    return xs.map(fn(x) => repeat(512, x,\n        fn(i) => fn(v) => v * 1664525 + 1013904223 + i));\n}\nfn adjust(xs: List<u32>) -> List<u32> {\n    return xs.map(fn(x) => x * 2 + 1);\n}\nfn total(xs: List<u32>) -> u32 { return sum(xs); }\n",
		input: JSON.stringify({
			inputs: { data: Array.from({ length: 8192 }, (e, t) => t) },
			steps: [
				{
					id: "heavy",
					call: "heavy",
					args: [{ input: "data" }]
				},
				{
					id: "adjust",
					call: "adjust",
					args: [{ step: "heavy" }]
				},
				{
					id: "total",
					call: "total",
					args: [{ step: "adjust" }]
				}
			],
			outputs: ["total"]
		})
	},
	{
		id: "prices",
		name: "State · prices and a total",
		entry: "@script",
		source: "module prices;\n\nstate Prices: Table<u64, u64> = Table.empty();\nkeep total_price: u64 = sum(Prices.values());\n\nchange set_price(item: u64, price: u64)\n    -> Result<Unit, String> writes(Prices)\n{\n    Prices.put(item, price);\n    return Ok(());\n}\n\nquery total() -> u64 reads(total_price) {\n    return total_price;\n}\n",
		input: JSON.stringify([
			{
				call: "set_price",
				args: [1, 40]
			},
			{
				call: "set_price",
				args: [2, 60]
			},
			{
				call: "total",
				args: []
			},
			{
				call: "set_price",
				args: [1, 45]
			},
			{
				call: "total",
				args: []
			}
		], null, 2)
	},
	{
		id: "pipeline",
		name: "Compute · map, filter and sum",
		entry: "total",
		source: "module pipeline;\n\nfn total(xs: List<u32>, scale: u32) -> u32 {\n    return sum(xs.map(fn(x) => x * scale)\n                 .filter(fn(x) => x > 100));\n}\n\nfn transformed(xs: List<u32>) -> List<u32> {\n    return xs.map(fn(x) => x * 3 + 7);\n}\n",
		input: JSON.stringify([Array.from({ length: 2048 }, (e, t) => t), 3])
	},
	{
		id: "generic",
		name: "Generics · collect before constructing",
		entry: "selected",
		source: "module collection;\n\nrecord Row { id: u32, score: u32, }\n\nfn collect<T, U>(xs: List<T>, keep: fn(T)->Bool,\n                 build: fn(T)->U) -> List<U> {\n    var out: Buffer<U> = Buffer.empty();\n    for item in xs {\n        if keep(item) { out = out.push(build(item)); }\n    }\n    return out.freeze();\n}\n\nfn selected(xs: List<Row>) -> List<Row> {\n    return collect<Row, Row>(xs,\n        fn(row) => row.score > 10,\n        fn(row) => Row { id: row.id, score: row.score + 1 });\n}\n",
		input: JSON.stringify([[
			{
				id: 1,
				score: 5
			},
			{
				id: 2,
				score: 20
			},
			{
				id: 3,
				score: 15
			}
		]], null, 2)
	},
	{
		id: "rollback",
		name: "Transactions · a failed change rolls back",
		entry: "@script",
		source: "module counter;\n\nenum Error { Failed, }\nstate Counters: Table<u64, u64> = Table.empty();\n\nchange set(key: u64, value: u64)\n    -> Result<Unit, Error> writes(Counters) {\n    if Counters.contains(key) { Counters.replace(key, value); }\n    else { Counters.insert(key, value); }\n    return Ok(());\n}\n\nchange rejected(key: u64) -> Result<Unit, Error> writes(Counters) {\n    Counters.remove(key);\n    return Err(Error.Failed);\n}\n\nquery get(key: u64) -> Option<u64> reads(Counters) {\n    return Counters.get(key);\n}\n",
		input: JSON.stringify([
			{
				call: "set",
				args: [7, 42]
			},
			{
				call: "rejected",
				args: [7]
			},
			{
				call: "get",
				args: [7]
			}
		], null, 2)
	},
	{
		id: "contracts",
		name: "Contracts · two proved implementations",
		entry: "next",
		source: "module Contracts;\n\nspec fn next(x:u32)->u32 ensures result == x+1;\nimplementation direct for next { return x+1; }\nimplementation commuted for next { return 1+x; }\n\nfn distinct(xs:List<u32>)->Bool { return unique(xs); }\nfn same_bag(xs:List<u32>,ys:List<u32>)->Bool {\n    return multiset(xs) == multiset(ys);\n}\n",
		input: "[41]"
	}
];
//#endregion
//#region src/index.ts
function i(i, a) {
	let o = new t(a.compilerUrl, (e) => E(e)), s = new n(new URL("./", a.compilerUrl).href), c = null, l = "", u = !1, d = 0, f = !1, p = "", m = r.find((e) => e.id === a.initialExample) ?? r[0];
	async function h(e) {
		if (!e?.bundleUrl) return;
		let t = await caches.open("ink-environment-bundles-v1");
		for (let n of await t.keys()) n.url.startsWith(e.bundleUrl) && await t.delete(n);
		await (await caches.open("ink-environment-profiles-v1")).delete(new URL("profile.json", e.bundleUrl));
	}
	i.classList.add("ink-environment"), i.innerHTML = `<header class="env-header"><div><a class="env-brand">ink</a><span class="env-slash">/ environment</span></div><span class="env-local">JS / WebGPU · Rust exports</span></header>
  <div class="env-intro"><div><h1>Write. Compile. Run.</h1><p>Edit Ink. Compile real targets. See the results and where the work ran.</p></div><a class="env-repo" href="https://github.com/siliconjungle/ink-app-ink-environment">Editor source ↗</a></div>
  <div class="env-toolbar"><label>Example <select id="env-example" aria-label="Example program"></select></label><div class="env-actions"><button id="env-compile" class="env-primary">Compile</button><button id="env-run" disabled>Run</button><button id="env-benchmark" disabled>Benchmark</button><button id="env-stop" disabled>Stop</button></div></div>
  <div class="env-execution"><label>Execution <select id="env-backend"><option value="javascript">JavaScript</option><option value="gpu">WebGPU · requires device support</option></select></label><span>Rust/Wasm builds use the native Ink toolchain.</span></div><div class="env-status" role="status" aria-live="polite"><span id="env-status">Ready to compile.</span><span id="env-size"></span></div>
  <div class="env-grid"><section class="env-panel env-source"><div class="env-panel-heading"><h2>Ink source</h2><span>⌘ / Ctrl + Enter to compile</span></div><label class="env-sr" for="env-source">Ink source</label><div class="env-editor"><pre id="env-lines" aria-hidden="true"></pre><textarea id="env-source" spellcheck="false" autocapitalize="off" autocomplete="off" wrap="off"></textarea></div></section>
  <div class="env-right"><section class="env-panel"><div class="env-panel-heading"><h2>Inputs</h2><select id="env-entry" aria-label="Entry point" disabled><option>Compile to choose an entry</option></select></div><p id="env-signature" class="env-signature">A state script or a function's JSON arguments.</p><label class="env-sr" for="env-input">Input JSON</label><textarea id="env-input" class="env-input" spellcheck="false" wrap="off"></textarea><details class="env-help"><summary>Input format</summary><p>Functions take a JSON argument array, for example <code>[[1, 2, 3], 2]</code>. State scripts take <code>[{"call":"total","args":[]}]</code>. Integer tokens keep their exact precision; use <code>{"Int":"123"}</code> for exact Int values. Pure pipelines use <code>{"inputs":{},"steps":[{"id":"a","call":"transform","args":[[1,2,3]]}]}</code>; later arguments can use <code>{"step":"a"}</code>. Single-file programs only.</p></details></section>
  <section class="env-panel env-result"><div class="env-panel-heading"><h2>Results</h2><button id="env-download-result" disabled>Download JSON</button></div><pre id="env-result" tabindex="0">Compile your program, then run it.</pre></section></div></div>
  <section class="env-panel env-placement"><div class="env-panel-heading"><h2>Execution placement</h2><span id="env-targets">Compile to inspect targets</span></div><div id="env-stage-strip" class="env-stage-strip"></div><pre id="env-placement">No execution yet.</pre></section><section class="env-panel env-performance"><div class="env-panel-heading"><h2>Performance</h2><span>Measured here, on this browser</span></div><div class="env-metrics"><div><span>Compile</span><strong id="env-compile-time">—</strong></div><div><span>First execution + output consumption</span><strong id="env-first-time">—</strong></div><div><span>Repeated median · output checked</span><strong id="env-median-time">—</strong></div><div><span>Samples</span><strong id="env-sample-count">—</strong></div></div><p id="env-measure-note">Run records one execution. Benchmark repeats the complete workload, starting with fresh state each time and consuming every returned value.</p><details><summary>Timing boundary and samples</summary><pre id="env-details">No measurements yet.</pre><p>Execution includes function calls or state creation and the full command script, plus output consumption and repeatability checks. Compiler loading, compilation, input validation/conversion, module loading and output formatting are separate. Rendering and worker message delivery are outside the execution timer. These are local measurements, not a comparison against another language or backend.</p></details></section>
  <details class="env-generated"><summary>Compiled artifacts <span id="env-code-size"></span></summary><button id="env-download-js" disabled>Download JavaScript</button><button id="env-download-rust" disabled>Download Rust source</button><pre id="env-generated-code" tabindex="0">No compiled module yet.</pre></details>
  <footer class="env-footer"><p>Code and inputs stay in your browser. Ink’s checker and target emitters run in Wasm; Rust source builds through the native Ink toolchain. The compiled Ink runtime executes the program.</p><p>Eligible pure pipelines execute on JavaScript or WebGPU. State executes on the host. Run never collects profitability measurements. External knowledge search and linked imports are outside this single-file environment.</p><p><a href="https://github.com/siliconjungle/ink-app-ink-environment">Standalone editor repository</a> · <a href="${new URL("ink-license.txt", new URL(a.compilerUrl, document.baseURI)).href}">MIT license</a> · <a href="${new URL("environment-info.json", new URL(a.compilerUrl, document.baseURI)).href}">Compiler and package versions</a></p></footer>`;
	let g = (e) => i.querySelector(`#env-${e}`), _ = g("source"), v = g("input"), y = g("entry"), b = g("example"), x = g("compile"), S = g("run"), C = g("benchmark"), w = g("stop"), T = g("backend");
	i.querySelector(".env-brand").href = a.homeUrl ?? "https://github.com/siliconjungle/ink-os-platform";
	for (let e of r) {
		let t = document.createElement("option");
		t.value = e.id, t.textContent = e.name, b.append(t);
	}
	b.value = m.id;
	function E(e, t = !1) {
		g("status").textContent = e, g("status").classList.toggle("env-error", t);
	}
	function D() {
		let e = !!c && _.value === l && !u;
		x.disabled = u, S.disabled = !e, C.disabled = !e, T.disabled = u || !c?.bundleUrl || y.value === "@script", w.disabled = !u, y.disabled = u || !c, b.disabled = u, _.readOnly = u, v.readOnly = u;
	}
	function O() {
		g("lines").textContent = Array.from({ length: _.value.split("\n").length }, (e, t) => String(t + 1)).join("\n"), g("size").textContent = `${new TextEncoder().encode(_.value).length.toLocaleString()} source bytes`;
	}
	function k() {
		if (a.storageKey) try {
			localStorage.setItem(a.storageKey, JSON.stringify({
				source: _.value,
				input: v.value,
				entry: y.value,
				example: b.value
			}));
		} catch {}
	}
	function A(e) {
		return e === null ? "—" : `${e < 1 ? e.toFixed(3) : e.toFixed(2)} ms`;
	}
	function j() {
		p = "", g("result").textContent = "Ready to run.";
		for (let e of [
			"first-time",
			"median-time",
			"sample-count"
		]) g(e).textContent = "—";
		g("download-result").disabled = !0, g("details").textContent = "No execution measurements for these inputs.";
	}
	function M() {
		if (c) {
			if (y.value === "@pipeline") g("signature").textContent = "Pure stage graph. Values flow through typed references on the selected target.";
			else if (y.value === "@script") {
				let e = c.manifest.state?.actions?.map((e) => e.name).join(", ");
				g("signature").textContent = `Fresh state. Commands: ${e ?? "none"}`;
			} else {
				let e = c.manifest.functions.find((e) => e.name === y.value);
				g("signature").textContent = `${e.name}(${e.params.map((e) => `${e.name}: ${e.type.name ?? e.type.kind}`).join(", ")}) → ${e.result.name ?? e.result.kind}`;
			}
		}
	}
	function N(e, t, n) {
		let r = URL.createObjectURL(new Blob([e], { type: n })), i = document.createElement("a");
		i.href = r, i.download = t, i.click(), setTimeout(() => URL.revokeObjectURL(r), 1e3);
	}
	async function P() {
		let t = c;
		c = null, h(t);
		let n = ++d;
		u = !0, D(), E("Checking Ink and emitting targets…");
		try {
			await e(new URL("./", a.compilerUrl).href);
			let t = await o.compile(_.value);
			if (f || n !== d) return;
			if (t.bundleUrl) {
				let e = await fetch(new URL("ink-gpu.mjs", t.bundleUrl));
				if (!e.ok) throw Error(`Local bundle loader returned ${e.status}; controller ${navigator.serviceWorker.controller?.scriptURL ?? "none"}; cached ${!!await (await caches.open("ink-environment-bundles-v1")).match(new URL("ink-gpu.mjs", t.bundleUrl))}`);
			}
			if (c = t, l = _.value, y.replaceChildren(), t.bundleUrl) {
				let e = document.createElement("option");
				e.value = "@pipeline", e.textContent = "Pure pipeline · fixed placement", y.append(e);
			}
			if (t.manifest.state?.actions?.length) {
				let e = document.createElement("option");
				e.value = "@script", e.textContent = "State script · fresh state", y.append(e);
			}
			for (let e of t.manifest.functions.filter((e) => !e.internal && !e.name.startsWith("__ink_"))) {
				let t = document.createElement("option");
				t.value = e.name, t.textContent = e.name, y.append(t);
			}
			let r = a.initialEntry ?? m.entry;
			if ([...y.options].some((e) => e.value === r) && (y.value = r), !y.options.length) throw Error("No public function, query or change to run.");
			M(), j(), g("compile-time").textContent = A(t.compileMs), g("targets").textContent = t.bundleUrl ? "JavaScript + WGSL · Rust/Wasm source exported" : "JavaScript host", g("placement").textContent = t.bundleUrl ? "Compiled targets ready. Choose JavaScript or an eligible WebGPU target." : t.host_reason ?? "Host execution", g("generated-code").textContent = (t.bundle ? JSON.stringify({
				manifest: t.bundle.manifest,
				shaders: t.bundle.shaders,
				rust: t.bundle.rust
			}, null, 2) + "\n\n" : "") + t.javascript.slice(0, 2e5) + (t.javascript.length > 2e5 ? "\n… display truncated; download the complete module." : ""), g("code-size").textContent = `· ${new TextEncoder().encode(t.javascript).length.toLocaleString()} bytes`, g("download-js").disabled = !1, g("download-rust").disabled = !t.rust, E("Compiled. Choose inputs, then Run or Benchmark."), k();
		} catch (e) {
			if (n !== d) return;
			c = null, g("compile-time").textContent = "—", g("result").textContent = String(e instanceof Error ? e.message : e), E("Compilation failed. See the diagnostic in Results.", !0);
		} finally {
			n === d && (u = !1, D());
		}
	}
	async function F(e) {
		if (!c || _.value !== l || u) return;
		let t = ++d;
		u = !0, D(), E("Checking input types…");
		let n = c;
		try {
			let r = await o.prepare(n, y.value, v.value);
			if (f || t !== d) return;
			E(e ? "Benchmarking compiled execution…" : "Running compiled Ink…");
			let i = await s.run(n, y.value, r.input, e, (e) => E(String(e)), { backend: T.value });
			if (f || t !== d) return;
			p = i.resultJson, g("result").textContent = p.length > 6e4 ? `${p.slice(0, 6e4)}\n… display truncated. Download JSON for the complete result.` : I(p), g("download-result").disabled = !1, g("first-time").textContent = A(i.firstMs), g("median-time").textContent = A(i.medianMs), g("sample-count").textContent = i.samples.length ? `${i.samples.length} × ${i.iterations}` : "1 run", g("measure-note").textContent = e ? "Repeated calls use fresh state and consume every output cell. Browser load and timer precision can affect these measurements." : "First execution measured. Use Benchmark for repeated samples; each starts with fresh state.", g("details").textContent = JSON.stringify({
				compilerLoadMs: n.compilerLoadMs,
				compileMs: n.compileMs,
				inputValidationMs: r.validationMs,
				moduleLoadMs: i.moduleLoadMs,
				runtimeLoadMs: i.runtimeLoadMs,
				inputBridgeMs: i.bridgeMs,
				firstExecutionAndConsumptionMs: i.firstMs,
				outputFormattingMs: i.serialisationMs,
				warmSamplesMs: i.samples,
				iterationsPerSample: i.iterations,
				minMs: i.minMs,
				maxMs: i.maxMs,
				outputCells: i.digest.cells,
				outputDigest: i.digest.hash,
				backend: i.backend,
				placement: i.placement,
				stages: i.stages,
				counters: i.counters,
				coreIdentity: n.manifest.core_sha256
			}, null, 2);
			let a = y.value === "@pipeline" ? JSON.parse(v.value) : { steps: [{
				id: "result",
				call: y.value
			}] }, c = g("stage-strip");
			c.replaceChildren();
			for (let [e, t] of (a.steps ?? [{ id: "state script" }]).entries()) {
				let n = i.stages?.find((t) => e >= t.start && e < t.end), r = document.createElement("div");
				r.className = "env-stage";
				let a = document.createElement("strong");
				a.textContent = t.id;
				let o = document.createElement("span"), s = n?.backend ?? i.backend;
				o.textContent = s === "cpu" ? "Wasm" : s === "gpu" ? "WebGPU" : s === "javascript" ? "JavaScript" : s, r.append(a, o), c.append(r);
			}
			g("placement").textContent = JSON.stringify({
				actualBackend: i.backend,
				profileLoaded: i.profileLoaded ?? !1,
				placement: i.placement ? {
					...i.placement,
					scope: void 0
				} : void 0,
				stages: i.stages,
				counters: i.counters
			}, null, 2), E(e ? "Benchmark complete. Full output checked for repeatability." : "Run complete."), k();
		} catch (e) {
			if (t !== d) return;
			g("result").textContent = String(e instanceof Error ? e.message : e), E("Run failed. See the diagnostic in Results.", !0);
		} finally {
			t === d && (u = !1, D());
		}
	}
	function I(e) {
		let t = "", n = 0, r = !1, i = !1;
		for (let a = 0; a < e.length; a++) {
			let o = e[a];
			r ? (t += o, i ? i = !1 : o === "\\" ? i = !0 : o === "\"" && (r = !1)) : o === "\"" ? (r = !0, t += o) : o === "{" || o === "[" ? (t += o, e[a + 1] !== "}" && e[a + 1] !== "]" && (n++, t += "\n" + "  ".repeat(n))) : o === "}" || o === "]" ? (e[a - 1] !== "{" && e[a - 1] !== "[" && (n--, t += "\n" + "  ".repeat(Math.max(0, n))), t += o) : t += o === "," ? ",\n" + "  ".repeat(n) : o === ":" ? ": " : o;
		}
		return t;
	}
	if (x.onclick = P, S.onclick = () => F(!1), C.onclick = () => F(!0), w.onclick = () => {
		d++, o.stop(), s.stop(), u = !1, E("Stopped. Compile again if a compilation was interrupted."), D();
	}, b.onchange = () => {
		m = r.find((e) => e.id === b.value), _.value = m.source, v.value = m.input, h(c), c = null, O(), j(), E("Example loaded. Compile to run it."), D(), k();
	}, _.oninput = () => {
		O(), E("Source changed. Compile before running."), D(), k();
	}, _.onscroll = () => {
		g("lines").scrollTop = _.scrollTop;
	}, v.oninput = () => {
		j(), k();
	}, y.onchange = () => {
		M(), j(), D(), k();
	}, _.onkeydown = (e) => {
		e.key === "Tab" && (e.preventDefault(), _.setRangeText("    ", _.selectionStart, _.selectionEnd, "end"), _.dispatchEvent(new Event("input")));
	}, i.addEventListener("keydown", (e) => {
		e.key === "Enter" && (e.metaKey || e.ctrlKey) && (e.preventDefault(), e.shiftKey ? F(!1) : !u && P());
	}), g("download-js").onclick = () => {
		c && N(c.javascript, "ink-program.mjs", "text/javascript");
	}, g("download-rust").onclick = () => {
		c?.rust && N(c.rust, "ink-program.rs", "text/plain");
	}, g("download-result").onclick = () => N(p, "ink-result.json", "application/json"), _.value = a.initialSource ?? m.source, v.value = a.initialInput ?? m.input, a.storageKey && !a.initialSource && !a.initialExample) try {
		let e = JSON.parse(localStorage.getItem(a.storageKey) ?? "null");
		e && typeof e.source == "string" && typeof e.input == "string" && (_.value = e.source, v.value = e.input, m = r.find((t) => t.id === e.example) ?? r[0], b.value = m.id);
	} catch {}
	return O(), D(), {
		compile: P,
		run: () => F(!1),
		benchmark: () => F(!0),
		dispose() {
			f = !0, d++, o.stop(), s.stop(), h(c), i.replaceChildren();
		}
	};
}
//#endregion
export { t as Compiler, n as Runner, r as examples, i as mountEnvironment };
