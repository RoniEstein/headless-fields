import { afterEach, describe, expect, test } from 'bun:test';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { useState, type ChangeEvent } from 'react';
import { healthNumber, phone, type Province } from '../src/definitions';
import {
    Field,
    FieldControl,
    FieldInput,
    FieldLabel,
    FieldMessage,
    FieldRoot,
    FieldSkinProvider,
    type FieldSkin,
} from '../src/dom';
import { staticField } from '../src/react';

afterEach(cleanup);

function Controlled({ initial = '', onValue }: { initial?: string; onValue?: (v: string) => void }) {
    const [value, setValue] = useState(initial);
    return (
        <>
            <Field
                definition={phone}
                value={value}
                onChange={(v) => {
                    setValue(v);
                    onValue?.(v);
                }}
                required
            />
            <button type="button" onClick={() => setValue('')}>reset</button>
        </>
    );
}

describe('Field', () => {
    test('links the label, formats as typed and emits only complete answers', () => {
        const emitted: string[] = [];
        render(<Controlled onValue={(v) => emitted.push(v)} />);
        const input = screen.getByLabelText(/Phone Number/) as HTMLInputElement;

        fireEvent.change(input, { target: { value: '204555' } });
        expect(input.value).toBe('(204) 555');
        expect(emitted).toEqual([]);

        fireEvent.change(input, { target: { value: '(204) 5551234' } });
        expect(input.value).toBe('(204) 555 - 1234');
        expect(emitted).toEqual(['(204) 555 - 1234']);
    });

    test('a blur issue hints while typing and becomes an error after blur', () => {
        render(<Controlled />);
        const input = screen.getByLabelText(/Phone Number/);
        fireEvent.focus(input);
        fireEvent.change(input, { target: { value: '204' } });
        const root = input.closest('[data-field]')!;
        expect(root.getAttribute('data-state')).toBe('idle');
        expect(screen.getByText('3 of 10 digits').getAttribute('data-tone')).toBe('hint');

        fireEvent.blur(input);
        expect(root.getAttribute('data-state')).toBe('invalid');
        expect(input.getAttribute('aria-invalid')).toBe('true');
        expect(input.getAttribute('aria-describedby')).toBe(screen.getByText('3 of 10 digits').id);
    });

    test('a reset from the form clears a partial answer', () => {
        render(<Controlled initial="(204) 555 - 1234" />);
        const input = screen.getByLabelText(/Phone Number/) as HTMLInputElement;
        fireEvent.change(input, { target: { value: '(204) 55' } });
        fireEvent.click(screen.getByText('reset'));
        expect(input.value).toBe('');
    });

    test('an unformatted prefill is normalised on mount', () => {
        const emitted: string[] = [];
        render(<Controlled initial="2045551234" onValue={(v) => emitted.push(v)} />);
        expect(emitted).toEqual(['(204) 555 - 1234']);
    });

    test('exposes the typing surface and adornment flags for the skin', () => {
        render(<Field definition={phone} value="" onChange={() => {}} start="+1" />);
        const root = screen.getByLabelText(/Phone/).closest('[data-field]') as HTMLElement;
        expect(root.style.getPropertyValue('--field-chars')).toBe('16');
        expect(root.hasAttribute('data-sized')).toBe(true);
        expect(root.hasAttribute('data-has-start')).toBe(true);
        expect(screen.getByText('+1').getAttribute('data-side')).toBe('start');
    });

    test('validateOnSubmit puts the issue in the native validity message', () => {
        render(<Field definition={phone} value="" onChange={() => {}} validateOnSubmit />);
        const input = screen.getByLabelText(/Phone/) as HTMLInputElement;
        fireEvent.change(input, { target: { value: '204' } });
        expect(input.validationMessage).toBe('3 of 10 digits');
    });

    test('a new province re-reads the value with its format', () => {
        function Card() {
            const [province, setProvince] = useState<Province>('MB');
            const [value, setValue] = useState('123456789');
            return (
                <>
                    <Field definition={healthNumber(province)} value={value} onChange={setValue} />
                    <button type="button" onClick={() => setProvince('AB')}>AB</button>
                    <output>{value}</output>
                </>
            );
        }
        render(<Card />);
        expect(screen.getByRole('status').textContent).toBe('123 456 789');
        act(() => fireEvent.click(screen.getByText('AB')));
        expect((screen.getByLabelText(/Personal Health Number/) as HTMLInputElement).value).toBe('12345-6789');
        expect(screen.getByRole('status').textContent).toBe('12345-6789');
    });
});

describe('skins', () => {
    const base: FieldSkin = {
        classNames: { root: 'root', input: 'box', message: 'msg' },
        icons: { invalid: <i>bad</i> },
    };

    test('the nearest provider wins; extend layers onto the parent; per-field classes go last', () => {
        render(
            <FieldSkinProvider skin={base}>
                <Field definition={phone} value="" onChange={() => {}} label="A" classNames={{ input: 'mine' }} />
                <FieldSkinProvider skin={{ classNames: { input: 'dark' } }} extend>
                    <Field definition={phone} value="" onChange={() => {}} label="B" />
                </FieldSkinProvider>
                <FieldSkinProvider skin={{ classNames: { input: 'other' } }}>
                    <Field definition={phone} value="" onChange={() => {}} label="C" />
                </FieldSkinProvider>
            </FieldSkinProvider>,
        );
        expect(screen.getByLabelText('A').className).toBe('box mine');
        expect(screen.getByLabelText('B').className).toBe('box dark');
        expect(screen.getByLabelText('C').className).toBe('other');
    });

    test('the skin supplies indicator icons', () => {
        render(
            <FieldSkinProvider skin={base}>
                <Field definition={phone} value="" onChange={() => {}} />
            </FieldSkinProvider>,
        );
        fireEvent.change(screen.getByLabelText(/Phone/), { target: { value: '1' } });
        expect(screen.getByText('bad')).toBeTruthy();
    });

    test('unskinned parts render bare elements', () => {
        render(<Field definition={phone} value="" onChange={() => {}} />);
        expect(screen.getByLabelText(/Phone/).getAttribute('class')).toBeNull();
    });
});

describe('static fields', () => {
    test('choice controls reuse the frame with page-supplied feedback', () => {
        render(
            <FieldRoot field={staticField({ error: 'Pick one', required: true })}>
                <FieldLabel>Delivery</FieldLabel>
                <FieldMessage />
            </FieldRoot>,
        );
        expect(screen.getByText('Pick one').getAttribute('data-state')).toBe('invalid');
        expect(screen.getByText('*')).toBeTruthy();
    });
});

describe('native mode', () => {
    test('inside a staticField frame the input is a plain native input', () => {
        const seen: string[] = [];
        function Plain() {
            const [value, setValue] = useState('');
            return (
                <FieldRoot field={staticField({ error: value ? '' : 'Needed', required: true })}>
                    <FieldLabel>Org</FieldLabel>
                    <FieldControl>
                        <FieldInput
                            value={value}
                            required={false}
                            onChange={(e: ChangeEvent<HTMLInputElement>) => {
                                seen.push(e.target.value);
                                setValue(e.target.value);
                            }}
                        />
                    </FieldControl>
                    <FieldMessage />
                </FieldRoot>
            );
        }
        render(<Plain />);
        const input = screen.getByLabelText(/Org/) as HTMLInputElement;
        expect(input.required).toBe(false);
        expect(input.getAttribute('aria-invalid')).toBe('true');
        fireEvent.change(input, { target: { value: 'Acme' } });
        expect(seen).toEqual(['Acme']);
        expect(input.value).toBe('Acme');
        expect(screen.queryByText('Needed')).toBeNull();
    });

    test('uncontrolled native inputs keep their defaultValue', () => {
        render(
            <FieldRoot field={staticField()}>
                <FieldInput defaultValue="abc" aria-label="pw" />
            </FieldRoot>,
        );
        expect((screen.getByLabelText('pw') as HTMLInputElement).value).toBe('abc');
    });
});
