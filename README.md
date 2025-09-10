# Reberrymemberer
A minimal postal experiment to send custom postcards across the world.
[reberrymemberer.com](https://reberrymemberer.com)

## ⚠️ Note on SvelteKit
This project uses an **experimental version** of SvelteKit with remote functions.  
It’s not recommended for production use, but it was chosen here for exploration and learning purposes.  

## Overview

- `src/`: the SvelteJS source code which consists of HTML, TypeScript and Sass.
- `lib/`: the SvelteJS library files which indicate shared code.
- `static/`: any public assets such as images.
- `.svelte-kit/cloudflare/`: the automatically generated Cloudflare Worker assets (from `npm install`), do not edit.
- `svelte.config.js`: the SvelteJS configuration file.
- `vite.config.ts`: the Vite configuration file.
- `tsconfig.json`: the TypeScript configuration file.
- `wrangler.jsonc`: the wrangler configuration file to run locally or deploy to Cloudflare Workers.

## Usage

Clone the repo and set it up locally:  
```bash
git clone https://github.com/paprikanotfound/reberrymemberer.git
cd reberrymemberer
npm install
npm run dev
```

## Roadmap

- Test API handlers, and Stripe webhook logic;
- Improve mobile usage;
- Add localization;

## License

```
Copyright 2025 Paprikanotfound

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

   http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
```