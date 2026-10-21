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

## Worked example: a health number, start to finish

A provincial health number shows most of the choices a field involves. The
same steps apply to a date or a postal code.

### 1. Pick the definition; don't rebuild the behaviour

```tsx
import { healthNumber, type Province } from 'headless-fields/definitions';

const definition = healthNumber(province); // 'MB' → PHIN, 'ON' → Health Card Number, ...
```

The definition already owns the format: digits only for Manitoba, grouped
`123 456 789`; ten digits plus a two-letter version code for Ontario; the
label, the placeholder, the "PHIN must be 9 digits" guidance and the typing
width. `healthNumber()` caches one definition per province, so the field can
tell "the province changed" from "the page re-rendered". Never build a
definition inside render (`date()` in JSX makes a new one every render and
the field resets): call factories once, at module level or in `useMemo`.

### 2. Decide what each piece of text does

| Text | Choice for this field | Why |
|---|---|---|
| Label | from the definition ("PHIN", "Health Card Number") | it changes with the province, for free |
| Placeholder | the format (`000 000 000`) | a format can't be mistaken for an answer as long as the skin keeps placeholders clearly lighter than answers |
| Hint | "On the front of your health card" | stays visible while they type; say where to find it, not what it looks like |
| Message | the definition's guidance, then errors | "PHIN must be 9 digits" is information while typing and becomes an error once they leave the field |
| Server error | `errors.health_number` from the backend | always wins |

Province-dependent help needs no function. Pass a different string and the
field re-renders:

```tsx
hint={province === 'ON' ? 'Include the two letters after the number' : 'On the front of your health card'}
```

Use a function hint only when the help depends on what is typed in this
field (`hint={(raw) => ...}` receives the text typed so far).

### 3. Wrap it once as a project field

```tsx
export function HealthNumberInput({ province, ...props }: HealthNumberInputProps) {
    return <Field definition={healthNumber(province)} {...props} />;
}

<HealthNumberInput
    province={province}
    value={form.data.health_number}
    onChange={(v) => form.setData('health_number', v)}
    required
    hint="On the front of your health card"
    serverError={form.errors.health_number}
/>
```

The form receives the formatted text (`123 456 789`), so it posts what the
user saw. Switching the province re-reads the stored value in the new
format.

### 4. Let the width say how long the answer is

The definition sizes the field from the placeholder: 11 characters for
Manitoba, 15 for Ontario. A skin that honours `data-sized` turns that into
a width (see the width section below), so a PHIN box is visibly short and grows when
the province switches to Ontario. Don't put it in half of a two-column grid:
the grid would pick the width, not the answer. Override with `chars` only
when your format really is longer than the definition's.

## Same field, two looks: two providers

Nothing about the health number changes between these looks. Only the
provider does.

### The project theme (labels above the box)

This is the shape of the Tache skin: semantic colour classes, a quiet hint
under the label, the message under the box, an answer in the heading colour
and a placeholder clearly lighter.

```tsx
export const tacheFieldSkin: FieldSkin = {
    merge: cn,
    classNames: {
        label: 'mb-1.5 block text-sm font-medium text-body',
        hint: 'mb-1.5 text-sm text-body-muted',
        control: 'relative',
        input: cn(
            'w-full rounded-lg border border-default bg-white px-4 py-2.5 pr-10 text-sm text-heading',
            'placeholder-stone-400 focus:border-accent focus:ring-2 focus:ring-accent-light focus:outline-none',
            'data-[state=invalid]:border-red-300',
        ),
        indicator: 'pointer-events-none absolute top-1/2 right-3 -translate-y-1/2',
        message: 'mt-1.5 text-sm font-medium data-[tone=error]:text-red-600 data-[tone=info]:text-accent',
    },
    icons: { valid: <CheckCircle className="size-5 text-accent" />, invalid: <XCircle className="size-5 text-red-500" /> },
};
```

### A floating-label variant of the same theme

Layer it over the theme with `extend`, so colours, borders and icons stay
the theme's and only placement changes:

```tsx
export const floatingLabels: FieldSkin = {
    classNames: {
        root: 'relative flex flex-col',
        label: cn(
            'pointer-events-none absolute top-3 left-4 z-10 mb-0 text-sm text-body-muted transition-all',
            'data-filled:top-1.5 data-filled:text-xs data-focused:top-1.5 data-focused:text-xs data-focused:text-accent',
        ),
        control: 'order-1',
        input: 'pt-5 pb-1.5 placeholder-transparent focus:placeholder-stone-400',
        hint: 'order-2 mt-1.5 mb-0',
        message: 'order-3',
    },
};
```

```tsx
<FieldSkinProvider skin={tacheFieldSkin}>
    <HealthNumberInput province="MB" … />            {/* label above */}

    <FieldSkinProvider skin={floatingLabels} extend>
        <HealthNumberInput province="MB" … />        {/* same field, label inside */}
    </FieldSkinProvider>
</FieldSkinProvider>
```

Choices the floating variant forces:

- **Write conflicting classes in the same form as the base skin.** `extend`
  merges with the theme's `cn`; tailwind-merge only drops the theme's
  `placeholder-stone-400` if the override is also a `placeholder-*` class.
- **The placeholder hides until focus.** The label sits where the
  placeholder would, so the format shows only while typing; the hint must
  carry anything the user needs before they start.
- **The hint and message move below the box** with `order`. All three
  (`control`, `hint`, `message`) need an order, or the unordered one jumps
  above the box.
- **The label must fit inside the box.** "PHIN" fits an 11-character box;
  "Personal Health Number" (British Columbia) does not. Shorten the label,
  or give the floating skin a minimum width (`control: 'order-1 min-w-48'`).
  Don't widen the field for its label in the label-above theme: there the
  label can be longer than the box.

## Width: size each field by its answer, on purpose

A box's width tells people how long an answer is expected to be. A postal
code in a full-width box looks like it wants an address. Width is a decision
for each field, made from the answer, not from the grid.

How the pieces divide the work:

1. **The definition** knows the answer length in characters: 7 for a postal
   code, 14 for a date (`MM / DD / YYYY`), 16 for a phone, the placeholder
   length for a health number. Free text has none and stays full width.
2. **The field** puts it on the root as `--field-chars` and sets
   `data-sized`. `chars` on a field overrides it.
3. **The skin** knows the padding and icons around the text (the chrome) and
   adds them: width = `chars × 1ch + chrome`. For the theme above that is
   `px-4` on the left, `pr-10` on the right for the ✓/✕, and a 1px border
   on each side: `1rem + 2.5rem + 2px`.

Keep sizing as its own layer, so a form opts in:

```tsx
export const intrinsicFieldWidths: FieldSkin = {
    classNames: {
        control: 'text-sm [--field-chrome:calc(3.5rem+2px)] data-sized:max-w-full data-sized:sm:w-[calc(var(--field-chars)*1ch+var(--field-chrome))]',
    },
};

<FieldSkinProvider skin={intrinsicFieldWidths} extend>{form}</FieldSkinProvider>
```

Rules for using it well:

- **Full width on phones, sized from `sm:` up.** A narrow screen has no room
  to spare and the width hint matters less there.
- **Change the chrome whenever padding changes.** If the skin adds an icon on
  the left (`data-has-start`), it adds that padding to `--field-chrome` in the
  same class string, or every sized field comes out short.
- **Set the font size on the control too.** `1ch` is the width of "0" in the
  element's own font, so the control must use the input's font size.
- **Letters run wider than digits.** `ch` is exact for digits and a little
  narrow for capitals; give a letters-heavy field (an Ontario version code,
  a Quebec RAMQ) a couple of extra `chars`.
- **Free text gets a cap, not a size.** Names `max-w-sm`, email
  `max-w-md`, notes and addresses the full column. Use `chars` for free text
  only when you know the answer's length (a room note of about 32).
- **Fields share a row only when they are one thought** (city and postal
  code, start and end time), never to fill space.
- **If the label is wider than its field, shorten the label.** "Approximate
  number of staff" over a 4-character box becomes "Staff count".

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
