# headless-fields

Headless form fields. The behaviour is written once; the look belongs to the
project, the page, or the section a field sits in.

```
headless-fields/core         DOM-free TypeScript. Masks, rules, the feedback policy,
                             field state as a pure reducer, file rules. Runs anywhere.
headless-fields/definitions  Field definitions built from the core: phone, postal code,
                             email, number, date, birthdate, time of day, health number
                             by province.
headless-fields/react        useField and useFileSelection: behaviour as hooks. No DOM,
                             so they work for React DOM and React Native.
headless-fields/dom          Unstyled parts, the composed <Field>, file fields, and skins.
```

A React Native renderer (`/native`) would sit beside `/dom` and reuse
everything above it. It is NOT YET IMPLEMENTED.

## Install

Install the release tarball for a tag:

```bash
bun add https://codeload.github.com/RoniEstein/headless-fields/tar.gz/refs/tags/v0.6.0
```

The lockfile pins the tarball's integrity hash. Prefer this over
`github:RoniEstein/headless-fields#v0.6.0` or a `git+https://github.com/…`
URL: Bun resolves both through `GITHUB_API_URL`, which Forgejo and Gitea
Actions point at their own forge, so installs in those CI runners fail.

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
integer: true })`, `date({ maxDate })`, `time({ minTime, maxTime, stepMinutes })`,
`healthNumber('MB')`.

`time()` gives the form 24-hour `HH:MM` (a database `09:00:00` loads as
`09:00`). It also accepts `930p` or an autofilled `9:30 PM`, and reads the
answer back on a 12-hour clock ("9:30 p.m.") so `21:30` is never misread.

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

Controls whose behaviour lives elsewhere (a Radix checkbox or select)
reuse the frame with `staticField({ error, hint, required })` in
place of `useField`.

Inside a `staticField` frame, `<FieldInput>` and `<FieldTextarea>` behave
as plain native controls (`value`/`defaultValue`/`onChange` pass through), so
a project can skin its ordinary inputs with the same frame. Explicit
`required` and `disabled` props on them win over the field's.

`validateOnSubmit` blocks native submission while the field has an issue,
with the issue as the browser's message.

## File fields

Three layers, same as the text fields:

| Layer | What it is | Use it to |
|---|---|---|
| Behaviour | `files()` definition + `useFileField` | Own all the markup: state, actions and prop getters carry the accessibility |
| Templates | `FilePickerField`, `FileDropField` | Get the two common patterns in one line; override rows or copy them |
| Skins | slot classes and icons from `FieldSkinProvider` | Style parts and templates, scoped per page or section |

Parts (`FileTrigger`, `FileDropArea`, `FileList`, …) sit in between: one
element each, bound to the behaviour through context, with a `render` prop to
use your own element or component.

The native `<input type="file">` is always the real control: visually hidden
but focusable and labelled, inside the trigger `<label>`. It works before
hydration, keeps native `required`, and Space/Enter open the picker. A drop
area is a plain region (no role, no tab stop), so there are no nested
controls; the trigger is the keyboard path. Transport is not included: post
the `File[]` value with your form (Inertia sends it as multipart).

### Definition (portable)

```ts
import { files, MB } from 'headless-fields/core';

export const artwork = files({
    accept: ['image/*', '.pdf', '.md', 'text/markdown'], // MIME, wildcards, extensions
    maxSize: 10 * MB,
    maxFiles: 5,              // default 1: a single file that a new pick replaces
    rejectDuplicates: true,   // default
    requiredMessage: 'Add your artwork or directions',
    messages: { tooLarge: (f, max) => `${f.name} is over ${max / MB} MB` }, // optional
    rules: [(f) => (f.name.startsWith('~$') ? { code: 'temp', message: 'Close the file first' } : null)],
});
// Rejection codes: type | too-large | too-small | too-many | duplicate | your own.
```

Browsers often report Markdown files with no MIME type, so list `.md` as an
extension, not only `text/markdown`.

### Templates

```tsx
import { FileDropField, FilePickerField } from 'headless-fields/dom';

// Click to select: trigger + "No files chosen" / "brief.pdf" / "3 files chosen", then the list.
<FilePickerField definition={artwork} label="Directions" value={files} onChange={setFiles}
                 required serverError={errors.directions} />

// Drop area: trigger + "or drop files here" inside a drop region, then the list.
<FileDropField definition={artwork} label="Artwork or directions" value={files} onChange={setFiles}
               hint="PNG, JPG, PDF or Markdown, up to 10 MB"
               renderItem={(entry) => <MyFileRow entry={entry} />} />
```

Template props: everything `FileField` takes (`definition`, `value`,
`onChange`, `required`, `disabled`, `serverError`, `hint`, `name`, `id`,
`strings`, `classNames`, `className`) plus `label`, `triggerLabel`,
`renderItem`, `children`, and `dropHint` on `FileDropField`.

### Parts

```tsx
import { FieldLabel, FieldMessage, FileAnnouncer, FileDropArea, FileField, FileItem, FileList,
         FileName, FilePreview, FileRejections, FileRemove, FileSize, FileTrigger } from 'headless-fields/dom';

<FileField definition={artwork} value={files} onChange={setFiles} required>
    <FieldLabel>Artwork</FieldLabel>
    <FileDropArea>
        <FileTrigger render={(props) => <label {...props} className={buttonClasses} />}>Browse</FileTrigger>
    </FileDropArea>
    <FileList>
        {(entry) => (
            <FileItem entry={entry}>
                <FilePreview /> <FileName /> <FileSize />
                <FileRemove render={<IconButton />} />
            </FileItem>
        )}
    </FileList>
    <FileRejections />
    <FieldMessage />
    <FileAnnouncer />
</FileField>
```

`render` takes an element (cloned with the part's props; handlers and
classes combine, refs both receive the node) or a function `(props, state)`
that must spread `props` onto a DOM element. `FileTrigger` must render a
`<label>`: it wraps the input. For your own `<button>`, call `open()` from
`useFileFieldContext()` (that path needs JavaScript).

### Behaviour only: your markup

```tsx
import { useFileField } from 'headless-fields/dom';

const f = useFileField(artwork, { value, onChange: setValue, required, serverError });

<div {...f.getRootProps({ className: 'uploader' })}>
    <span {...f.getLabelProps()}>Artwork</span>
    <div {...f.getDropProps({ className: 'canvas' })}>
        <label {...f.getTriggerProps({ className: 'btn' })}>
            <input {...f.getInputProps()} /> Browse files
        </label>
    </div>
    <ul>
        {f.entries.map((e) => (
            <li key={e.id} {...f.getItemProps(e)}>
                {e.kind === 'image' && <img src={f.previewUrl(e)} alt="" />}
                {e.name}, {formatBytes(e.size)}
                <button {...f.getRemoveProps(e)}>×</button>
            </li>
        ))}
    </ul>
    {f.rejections.map((r) => <p key={r.file.name} {...f.getRejectionProps(r)}>{r.message}</p>)}
    <p {...f.getMessageProps()}>{f.view.message}</p>
    <div {...f.getAnnouncerProps()}>{f.announcement}</div>
</div>
```

| Getter | Gives |
|---|---|
| `getInputProps` | `type=file`, id, `accept`, `multiple`, `required`, `aria-labelledby` (label + trigger), `aria-describedby`, visually hidden style, change/blur handling |
| `getTriggerProps` | id and `htmlFor` for the wrapping `<label>` |
| `getLabelProps` | id and `htmlFor` for the field label |
| `getDropProps` | drag enter/over/leave/drop handlers; no role or tab stop |
| `getItemProps(entry)` | `data-kind`, `data-file-id` |
| `getRemoveProps(entry)` | `type=button`, "Remove name" label, removal with focus moving to the next file or the input |
| `getRejectionProps(r)` | `data-error-code` |
| `getMessageProps` / `getAnnouncerProps` | message id and tone; a polite, visually hidden live region |

Every getter takes your props and merges them: your handlers run first, and
`event.preventDefault()` skips ours. Skip a getter and you skip what it
provides. State: `entries`, `rejections`, `announcement`, `summary`, `view`,
`dragging`, `dragReject`, `maxReached`. Actions: `add`, `remove`, `clear`,
`open`, `touch`. `previewUrl(entry)` gives revoked-on-removal object URLs for
images.

### Skin slots and state

Slots: `trigger`, `dropArea`, `dropHint`, `fileSummary`, `fileList`,
`fileItem`, `filePreview`, `fileName`, `fileSize`, `fileRemove`,
`fileRejections`, `fileRejection`, plus the shared `label` and `message`.
Icons: `upload` (in triggers), `remove`, `file` (rows without an image).

State attributes on every file part: `data-state`, `data-disabled`,
`data-required`, `data-has-files`, `data-max-reached`, `data-dragging`,
`data-drag-reject`. Rows add `data-kind="image|pdf|text|other"`; rejections
add `data-error-code`.

```ts
const skin: FieldSkin = {
    merge: cn,
    classNames: {
        dropArea: 'rounded-xl border-2 border-dashed p-6 data-dragging:border-accent data-drag-reject:border-red-400',
        trigger: 'inline-flex cursor-pointer rounded-lg border px-4 py-2 has-[:focus-visible]:ring-2',
        fileItem: 'flex items-center gap-3 rounded-lg border px-3 py-2',
        filePreview: 'size-10 rounded object-cover',
        fileRemove: 'ml-auto rounded p-1',
        fileRejection: 'text-sm text-red-600',
    },
    icons: { upload: <Upload aria-hidden />, remove: <X aria-hidden />, file: <FileText aria-hidden /> },
};
```

### Other platforms

`useFileSelection` in `headless-fields/react` is the same behaviour without
the DOM: give it a `describe(handle)` for your platform's file handle. A
React Native picker adapter (Expo) is NOT YET IMPLEMENTED.

### Browser checks

`bun run test:browser` bundles a harness and drives it in a real browser
(`BROWSER=chromium|firefox|webkit`): keyboard picker, focus styling, real
drops, native validity, previews and removal focus, plus radio groups:
arrow keys, required feedback, form data and card clicks.

## Radio groups

Native `<input type="radio">` underneath, so the browser supplies the
keyboard (Tab into the group, arrows between options), form submission and
`required`. Two starter compositions cover the two kinds of question:

| | For | Each option |
|---|---|---|
| `RadioGroupField` | Plain answers: Yes / No, M / F / X | a radio and a short label |
| `RadioCardsField` | Options with detail: plans, delivery methods | a card: radio, title, any markup |

They differ in markup and slots, not just classes: a plain option is named by
its label and only the radio and label choose it; a card is named by its
title, described by its content (a `<div>`, so lists, prices and badges are
valid), and a click anywhere on it chooses it (links and buttons inside keep
their own clicks).

```tsx
import { RadioCardsField, RadioGroupField } from 'headless-fields/dom';

<RadioGroupField label="Are you the person who decides on this?" required
    options={[{ value: 'yes', label: 'Yes' }, { value: 'no', label: 'No' }]}
    value={data.decider} onChange={(v) => setData('decider', v)}
    serverError={errors.decider} />

<RadioCardsField label="Plan" value={data.plan} onChange={(v) => setData('plan', v)}
    options={[
        { value: 'regular', label: 'Regular', description: <ul><li>One site</li></ul> },
        { value: 'pro', label: 'Pro', description: <Features plan="pro" /> },
    ]} />
```

The value is a string, `''` while nothing is chosen. Options: `required`,
`requiredMessage` (default "Choose an option", shown once focus leaves the
group unanswered), `serverError` (always shown), `hint`, `disabled`, `name`
(the form name; generated when omitted), `id`, `showValidIndicator`. Option
`disabled` disables one option. `RadioCardsField` also takes
`renderOption(option, { checked })` for your own card content.

### Parts

```tsx
<RadioGroup value={plan} onChange={setPlan} name="plan">
    <RadioGroupLabel>Plan</RadioGroupLabel>
    <RadioCards render={<section />}>
        <RadioCard value="pro" render={(props, { checked }) => <article {...props} />}>
            <RadioLabel>Pro</RadioLabel>
            <RadioDescription><Price /> <FeatureList /></RadioDescription>
        </RadioCard>
    </RadioCards>
    <FieldMessage />
</RadioGroup>
```

`RadioOptions` / `RadioCards` are the `role="radiogroup"` element, labelled
by `RadioGroupLabel` (a `<span>`, since it names a group, not one input).
`Radio` / `RadioCard` render the native radio first, then their children.
`RadioLabel` is the option's `<label>`; `RadioDescription` is linked to the
radio with `aria-describedby`. Every part takes `className` and `render`.

### Behaviour only: your markup

```tsx
const g = useRadioGroup({ value, onChange, required });

<fieldset {...g.getGroupProps()}>
    <legend {...g.getLabelProps()}>Size</legend>
    {sizes.map((s) => (
        <div key={s.value} {...g.getCardProps(s)}>   {/* or getItemProps: no click-anywhere */}
            <input {...g.getInputProps(s)} />
            <label {...g.getOptionLabelProps(s)}>{s.name}</label>
            <div {...g.getDescriptionProps(s)}>{s.details}</div>
        </div>
    ))}
    {g.view.message && <p {...g.getMessageProps()}>{g.view.message}</p>}
</fieldset>
```

Getters take an option `{ value, disabled? }` and your own props to merge
(your handlers run first; `preventDefault()` skips ours). `useChoice` in
`headless-fields/react` is the same behaviour without the DOM, for React
Native or a custom control.

### Skin slots and state

Plain: `radioOptions`, `radio`, `radioInput`, `radioLabel`,
`radioDescription`. Cards: `radioCards`, `radioCard`, `radioCardInput`,
`radioCardLabel`, `radioCardDescription`. Plus the shared `label`,
`requiredMark` and `message`. Every part carries `data-state`, `data-tone`,
`data-touched`, `data-required`; options add `data-checked` and
`data-disabled`. Style focus with `has-[:focus-visible]`.

```ts
classNames: {
    radioOptions: 'flex flex-col gap-2',
    radio: 'flex items-center gap-2',
    radioInput: 'size-4 accent-[var(--accent)]',
    radioCards: 'grid gap-3 sm:grid-cols-3',
    radioCard: 'relative cursor-pointer rounded-xl border p-4 data-checked:border-accent has-[:focus-visible]:ring-2',
    radioCardLabel: 'font-semibold',
    radioCardDescription: 'mt-2 text-sm',
}
```

## Develop

```bash
bun install
bun run check   # tsc + bun test
```

Release: bump `version` in package.json, tag `vX.Y.Z`, push the tag, then
bump the `#vX.Y.Z` pin in each consumer.
