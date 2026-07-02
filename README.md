# Storymap

A workshop tool for laying out a product as a Jeff-Patton-style story map.

## Tests

End-to-end tests (Cucumber + Playwright, driving a real browser over `docs/`)
live in `test/`. Once-off setup:

```bash
cd test
bundle install
npx playwright install chromium
```

Then run the suite (boots the Playwright server + a static server and runs
every scenario):

```bash
ruby run.rb                # whole suite
ruby run.rb -p smoke       # @smoke only
```

See [`test/CLAUDE.md`](./test/CLAUDE.md) for conventions.

## License

[MIT](./LICENSE) — Copyright (c) 2026 Santiago Ferreira.
