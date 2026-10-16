# headless-fields

Headless form fields. The behaviour is written once; the look belongs to the
project, the page, or the section a field sits in.

```
headless-fields/core         DOM-free TypeScript. Masks, rules, the feedback policy,
                           field state as a pure reducer. Runs anywhere.
headless-fields/definitions  Field definitions built from the core: phone, postal code,
                           email, number, date, birthdate, health number by province.
headless-fields/react        useField: the base behaviour as a hook. No DOM, so it works
                           for React DOM and React Native.
headless-fields/dom          Unstyled parts, the composed <Field>, and skins.
```

A React Native renderer (`/native`) would sit beside `/dom` and reuse
everything above it. It is NOT YET IMPLEMENTED.

## Install

A git dependency pinned to a tag:

```bash
bun add github:RoniEstein/headless-fields#v0.3.0
```

The package ships TypeScript source. Bundlers compile it like your own code.
For Vite SSR, keep it bundled so Node never loads `.ts` at runtime:

```ts
// vite.config.ts
ssr: { noExternal: ['headless-fields'] }
```

## The layers

A field is built up in layers. Each layer adds one thing and knows nothing
about the layers above it.

| Layer | Owns | Lives in |
|---|---|---|
| Base | controlled value, focus and touched, ids and ARIA, the feedback policy, the typing surface | `useField`, the parts |
| Validation | rules: plain functions `raw → Issue \| null` | the definition |
| Masking | display ⇄ raw ⇄ value, character filtering, when the form receives a value | the definition |
| Skin | every class, the indicator icons, the chrome in the width | the project |
| Named field | a definition plus a skin, e.g. `PhoneInput` | the project |

Validation is not a separate wrapper. Every field has `required` and server
errors, so a field without validation never happens in practice. What must
stay identical everywhere is *when* a message appears, so that policy sits in
the base and the rules are data:

1. A server error always wins.
2. An `immediate` issue is an error at once (a bad area code).
3. A `blur` issue is a hint while the user types ("3 of 10 digits") and
   becomes an error once they leave the field. Refocusing turns it back into
   a hint.
4. Otherwise the definition's description ("January 2, 1980"), then the
   static `hint`.
5. Valid means non-empty, complete and issue-free.

### Three values

| | Phone | Birthdate |
|---|---|---|
| display (in the box) | `(204) 555 - 1234` | `01 / 02 / 1980` |
| raw (canonical) | `2045551234` | `01021980` |
| value (the form gets) | `(204) 555 - 1234` | `1980-01-02` |

The mask converts display ⇄ raw; the codec converts raw ⇄ value. Masked
fields use `emit: 'when-valid'`: the form receives complete, issue-free answers
and clears, never half-typed ones. Plain text and numbers use `always`.

## Writing a definition

```ts
import { defineField, hinted, labelled, masked, sized, text, validated } from 'headless-fields/core';

export const phone = defineField(
    text(),                                                      // base: a string
    hinted({ type: 'tel', keyboard: 'numeric', autoComplete: 'tel' }),
    masked(nanpMask),                                            // display ⇄ raw
    validated(nanpAreaCode, nanpExchange),                       // rules, in order
    labelled('Phone Number', '(555) 123 - 4567'),
    sized(16),                                                   // typing surface
);
```

A mask is four small functions: `accept` (typed text → raw), `format`
(raw → display), `complete`, and an optional `incomplete` message. A rule
returns `{ message, timing: 'immediate' | 'blur' }` or `null`.

Definitions that depend on options are factories: `number({ min: 1, max: 99,
integer: true })`, `date({ maxDate })`, `healthNumber('MB')`.

## Sizing

A field's width depends on things no single layer knows: the length of the
answer, the padding, whether there is an icon on the left and a ✓ on the
right. Each layer contributes what it knows:

1. **The definition** knows the typing surface in characters: 16 for a
   phone, 7 for a postal code, 2 for `number({ max: 99 })`, the placeholder
   length for a health card. Free text has none.
2. **The base** puts it on the root as `--field-chars` and flags what is in
   the box: `data-sized`, `data-has-start`, `data-has-end`,
   `data-reserve-indicator`.
3. **The skin** knows the chrome. The rule that adds left padding for an icon
   also adds that padding to `--field-chrome`, so the two never drift apart.
   Width = `chars × 1ch + chrome`.
4. **The form** can still override (full width on mobile, a fixed column).

Set the input's font size on the control too, because `1ch` is measured in
the font of the element that uses it. `ch` is the width of "0": exact for
digits, a little narrow for capital letters, so scale it in the skin if a
field is all letters.

```ts
control: [
    'relative w-full max-w-full text-sm',
    '[--field-chrome:calc(2rem+2px)]',                                  // px-4 + border
    'data-reserve-indicator:[--field-chrome:calc(3.5rem+2px)]',          // + pr-10 for ✓/✕
    'data-has-start:data-reserve-indicator:[--field-chrome:calc(5rem+2px)]',
    'data-sized:sm:w-[calc(var(--field-chars)*1ch+var(--field-chrome))]',
].join(' '),
```

Use `chars` on a field to override the definition (`<Field chars={4} …>`).

## Skins and themes

A skin is plain data: class strings per slot and the indicator icons. State
comes from data attributes on every part, so a skin needs no logic:

| Attribute | Values |
|---|---|
| `data-state` | `idle`, `valid`, `invalid` |
| `data-tone` | `error`, `hint` (on every part; meant for the message) |
| `data-focused`, `data-touched`, `data-disabled`, `data-required` | present or absent |
| `data-indicator` | `valid`, `invalid` (the icon being shown) |
| `data-sized`, `data-has-start`, `data-has-end`, `data-reserve-indicator` | present or absent |

Slots: `root`, `label`, `requiredMark`, `control`, `input`, `adornment`
(with `data-side="start|end"`), `indicator`, `message`.

```tsx
import { FieldSkinProvider, type FieldSkin } from 'headless-fields/dom';
import { cn } from '@/lib/utils';

export const skin: FieldSkin = {
    merge: cn,   // tailwind-merge, so per-field classes override cleanly
    classNames: {
        label: 'mb-1.5 block text-sm font-medium text-body',
        input: 'w-full rounded-lg border px-4 py-2.5 data-[state=invalid]:border-red-300',
        message: 'mt-1.5 text-sm data-[tone=error]:text-red-600 data-[tone=hint]:text-accent',
    },
    icons: { valid: <CheckCircle />, invalid: <XCircle /> },
};

<FieldSkinProvider skin={skin}>…</FieldSkinProvider>
```

Several themes at once:

- **The nearest provider wins.** Wrap a page, a section, or a state (a dark
  hero, a compact staff table) in its own `FieldSkinProvider`.
- **`extend`** layers a skin over the inherited one, for small variations:
  `<FieldSkinProvider skin={onDark} extend>`.
- **`classNames` on a field** merges last, for one-off tweaks.
- **Colour themes** that already switch CSS variables need no new skin when
  the skin uses token classes (`text-body`, `border-accent`).

## Using it

The composed field covers the usual layout:

```tsx
import { Field } from 'headless-fields/dom';
import { phone } from 'headless-fields/definitions';

<Field definition={phone} value={form.phone} onChange={(v) => setData('phone', v)}
       required serverError={errors.phone} />
```

For anything else, compose the parts. They all read the field from context:

```tsx
const field = useField(phone, { value, onChange });

<FieldRoot field={field} hasStart>
    <FieldLabel />
    <FieldControl>
        <FieldAdornment side="start"><PhoneIcon /></FieldAdornment>
        <FieldInput validateOnSubmit />
        <FieldIndicator />
    </FieldControl>
    <FieldMessage />
</FieldRoot>
```

Controls whose behaviour lives elsewhere (a Radix checkbox, radio group or
select) reuse the frame with `staticField({ error, hint, required })` in
place of `useField`.

Inside a `staticField` frame, `<FieldInput>` and `<FieldTextarea>` behave
as plain native controls (`value`/`defaultValue`/`onChange` pass through), so
a project can skin its ordinary inputs with the same frame. Explicit
`required` and `disabled` props on them win over the field's.

`validateOnSubmit` blocks native submission while the field has an issue,
with the issue as the browser's message.

## Develop

```bash
bun install
bun run check   # tsc + bun test
```

Release: bump `version` in package.json, tag `vX.Y.Z`, push the tag, then
bump the `#vX.Y.Z` pin in each consumer.
