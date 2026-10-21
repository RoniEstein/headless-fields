# Writing a skin for headless-fields

A guide for AI agents (and people) setting up headless-fields in a project
that has its own design system. Follow the steps in order. The result is
one skin file and one provider at the app root; no field component needs
styling of its own.

## The contract

- **headless-fields owns behaviour.** It decides what a field knows (the
  answer, what is wrong, the help text, filled, focused), when a message
  appears, and all ARIA wiring. It renders bare elements and stamps state on
  them as `data-*` attributes.
- **The skin owns looks and placement.** Class strings per slot, plus icons.
  A skin is plain data: no functions, no state, no conditionals. Every state
  is styled through a data attribute.
- **Don't fork behaviour to get a look.** If a design needs state the parts
  don't expose, that is a missing attribute in the library, not something to
  compute in the skin or the page.

## Step 1: read the project before writing classes

Find, and write down:

1. **The class merger.** Tailwind projects usually have `cn()` (clsx +
   tailwind-merge) in `lib/utils`. Use it as the skin's `merge` so per-field
   classes override the skin cleanly.
2. **The tokens.** Semantic colour classes or CSS variables for text,
   muted text, borders, the accent, errors, and the field background. Use
   them; never hardcode a colour the project already names.
3. **Existing form styles.** An input or label component in the project's UI
   kit (shadcn `Input`, a Tailwind UI form) gives the padding, radius, height
   and focus ring the new fields must match.
4. **Icons.** The project's icon set, for the valid/invalid indicators and the
   file field icons.

## Step 2: write the skin

Create one file (for example `components/forms/skin.tsx`) exporting a
`FieldSkin`. Fill every slot the project uses; leave out slots for field
kinds it does not use (no file fields, no file slots).

```tsx
import type { FieldSkin } from 'headless-fields/dom';
import { CheckCircle, XCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

export const projectSkin: FieldSkin = {
    merge: cn,
    classNames: {
        root: 'flex flex-col',
        label: 'mb-1.5 text-sm font-medium text-body',
        requiredMark: 'ml-0.5 text-red-600',
        hint: 'mb-1.5 text-sm text-body-muted',
        control: 'relative',
        input: cn(
            'w-full rounded-lg border border-default bg-white px-4 py-2.5 pr-10 text-sm text-heading',
            'placeholder:text-gray-500 focus:border-accent focus:ring-2 focus:ring-accent/30 focus:outline-none',
            'data-[state=invalid]:border-red-300 disabled:cursor-not-allowed disabled:opacity-60',
        ),
        indicator: 'pointer-events-none absolute top-1/2 right-3 -translate-y-1/2',
        message: 'mt-1.5 text-sm data-[tone=error]:font-medium data-[tone=error]:text-red-600 data-[tone=info]:text-body-muted',
    },
    icons: {
        valid: <CheckCircle className="size-5 text-green-600" aria-hidden />,
        invalid: <XCircle className="size-5 text-red-600" aria-hidden />,
    },
};
```

Leave `name` unset. A named skin of `'default'` would switch the default
stylesheet back on.

## Step 3: provide it

Wrap the app once, in **every** entry that renders React: the client entry
and, with SSR, the server entry. A provider missing from one entry gives
unstyled fields there and a hydration mismatch.

```tsx
<FieldSkinProvider skin={projectSkin}>{app}</FieldSkinProvider>
```

Variations are layers, not copies:

```tsx
// Only this form: fields sized to their answers.
<FieldSkinProvider skin={{ classNames: { control: 'data-sized:sm:w-[calc(var(--field-chars)*1ch+3.5rem)]' } }} extend>
```

`extend` merges slot by slot over the inherited skin. The nearest provider
wins; `classNames` on one field merges last.

## Reference: slots

| Slot | Element | Used by |
|---|---|---|
| `root` | `<div>` around the whole field; carries `--field-chars` | all |
| `label` | `<label>` (radio groups: `<span>`) | all |
| `requiredMark` | `<span>` inside the label, `aria-hidden` | all |
| `hint` | `<p>` of help that stays visible; absent without a hint | all |
| `control` | `<div>` around the input, adornments and indicator | text, file picker |
| `input` | `<input>` / `<textarea>` | text |
| `adornment` | `<div>` before/after the input, `data-side="start\|end"` | text |
| `indicator` | `<div>` holding the valid/invalid icon | text |
| `message` | `<p>` of errors and information about the answer | all |
| `radioOptions`, `radioCards` | the `role="radiogroup"` element | radio |
| `radio`, `radioCard` | one option | radio |
| `radioInput`, `radioCardInput` | the native radio | radio |
| `radioLabel`, `radioCardLabel` | the option's `<label>` | radio |
| `radioDescription`, `radioCardDescription` | detail under an option | radio |
| `trigger` | the `<label>` acting as the choose button | files |
| `dropArea`, `dropHint` | drop zone and its text | files |
| `fileSummary`, `fileList`, `fileItem`, `filePreview`, `fileName`, `fileSize`, `fileRemove` | the chosen files | files |
| `fileRejections`, `fileRejection` | files refused, with reasons | files |

Every part also has `data-slot="<slot>"`, so plain CSS can target parts
without classes.

## Reference: state attributes

On every part of a field:

| Attribute | Meaning |
|---|---|
| `data-state="idle\|valid\|invalid"` | the field's validity |
| `data-tone="error\|info"` | what the message is; absent with no message |
| `data-filled` | the field holds an answer |
| `data-focused` | the user is in the field (text fields) |
| `data-touched` | the user has left the field at least once |
| `data-disabled`, `data-required` | as named |
| `data-indicator="valid\|invalid"` | which icon is showing |
| `data-sized` | the answer has a known width (`--field-chars` on the root) |
| `data-has-start`, `data-has-end` | adornments present |
| `data-reserve-indicator` | room is kept for the indicator icon |

Radio options add `data-checked` and `data-disabled`. File parts add
`data-has-files`, `data-max-reached`, `data-dragging`, `data-drag-reject`;
items add `data-kind="image|file"`; rejections add `data-error-code`. Native
pseudo-classes still work: `:focus-visible`, `:disabled`,
`:placeholder-shown`; use `has-[:focus-visible]` on wrappers.

Icons (`icons` on the skin): `valid`, `invalid`, `upload`, `remove`, `file`.

## Rules that keep fields readable

- **Hint and message are different jobs.** The hint is fixed help ("For
  example, Training room") and should look quiet. The message is about the
  answer: `info` ("3 of 10 digits", "April 4, 1992") reads as feedback,
  `error` must stand out by colour **and** weight or an icon, never colour
  alone.
- **A placeholder must not look like an answer.** Keep answers in the
  heading text colour and placeholders clearly lighter, at 4.5:1 or better
  on the field background. Example values belong in the hint or after
  "e.g."; format masks (`MM / DD / YYYY`) are fine as placeholders.
- **Placement is CSS.** The markup order is label, hint, control, message.
  To move the hint under the box, make the root `flex flex-col` and give
  `control`, `hint` and `message` an `order`. Give all three an order, or an
  unordered message jumps above the box.
- **A floating label is a skin:** label absolute inside the root, large while
  empty, small at the top on `data-filled` or `data-focused`; input padded at
  the top; placeholder transparent until focus. The README has the classes.
- **Size fields by their answer** with `data-sized` and `--field-chars`
  instead of grid columns; full width on small screens.

## Step 4: verify by eye

Code that should look right is not verified. Render a page with each field
kind the project uses and screenshot these states at desktop and phone
widths:

1. Empty with placeholder, and filled. They must be told apart at a glance.
2. Focused.
3. A hint and an error at the same time (both visible, error distinct).
4. An `info` message while typing (a phone number half typed).
5. Valid with the indicator, and disabled.
6. Radio group with one option checked, and keyboard focus on an option.
7. File field empty, with files, and with a rejection (if used).

Fix what reads badly, then re-check. If the project has tests for form
layout, pin the important classes there.
