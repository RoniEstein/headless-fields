import { afterEach, describe, expect, test } from 'bun:test';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import {
    FieldSkinProvider,
    RadioCard,
    RadioCards,
    RadioCardsField,
    RadioDescription,
    RadioGroup,
    RadioGroupField,
    RadioGroupLabel,
    RadioLabel,
    SegmentedChoice,
    useRadioGroup,
    type FieldSkin,
} from '../src/dom';

afterEach(cleanup);

const yesNo = [
    { value: 'yes', label: 'Yes' },
    { value: 'no', label: 'No' },
] as const;

function Plain({ onValue, required = true }: { onValue?: (v: string) => void; required?: boolean }) {
    const [value, setValue] = useState<'yes' | 'no' | ''>('');
    return (
        <>
            <RadioGroupField
                label="Are you the person who decides?"
                options={yesNo}
                value={value}
                onChange={(v) => {
                    setValue(v);
                    onValue?.(v);
                }}
                required={required}
            />
            <button type="button">after</button>
        </>
    );
}

describe('RadioGroupField', () => {
    test('native radios in a labelled radiogroup', () => {
        render(<Plain />);
        const group = screen.getByRole('radiogroup', { name: /Are you the person who decides/ });
        const radios = screen.getAllByRole('radio') as HTMLInputElement[];
        expect(radios.map((r) => r.type)).toEqual(['radio', 'radio']);
        expect(new Set(radios.map((r) => r.name)).size).toBe(1);
        expect(radios.every((r) => r.required)).toBe(true);
        expect(group.getAttribute('aria-required')).toBe('true');
        expect(screen.getByLabelText('Yes')).toBe(radios[0]);
        // The group label names the group; it is not a <label> for one input.
        expect(screen.getByText(/Are you the person/).tagName).toBe('SPAN');
    });

    test('choosing reports the value and marks the option checked', () => {
        const seen: string[] = [];
        render(<Plain onValue={(v) => seen.push(v)} />);
        fireEvent.click(screen.getByLabelText('No'));
        expect(seen).toEqual(['no']);
        const no = screen.getByLabelText('No') as HTMLInputElement;
        expect(no.checked).toBe(true);
        expect(no.parentElement?.hasAttribute('data-checked')).toBe(true);
        expect(screen.getByLabelText('Yes').parentElement?.hasAttribute('data-checked')).toBe(false);
    });

    test('a required group complains only after focus leaves it unanswered', () => {
        render(<Plain />);
        const group = screen.getByRole('radiogroup');
        const [yes, no] = screen.getAllByRole('radio');
        fireEvent.blur(yes, { relatedTarget: no });
        expect(screen.queryByText('Choose an option')).toBeNull();
        fireEvent.blur(no, { relatedTarget: screen.getByText('after') });
        expect(screen.getByText('Choose an option').getAttribute('data-tone')).toBe('error');
        expect(group.getAttribute('aria-invalid')).toBe('true');
        expect(group.getAttribute('aria-describedby')).toBe(screen.getByText('Choose an option').id);
    });

    test('the group hint stays beside an error and both describe the group', () => {
        render(
            <RadioGroupField label="Decides?" options={yesNo} value="" onChange={() => {}} hint="Pick the closest" serverError="Choose one" />,
        );
        const group = screen.getByRole('radiogroup');
        const hint = screen.getByText('Pick the closest');
        expect(hint.id).toBeTruthy();
        expect(group.getAttribute('aria-describedby')).toBe(`${hint.id} ${screen.getByText('Choose one').id}`);
    });

    test('a server error shows at once; option descriptions describe their radio', () => {
        render(
            <RadioGroupField
                label="Contact"
                options={[{ value: 'direct', label: 'Contact them directly', description: 'We email them today' }]}
                value=""
                onChange={() => {}}
                serverError="Choose how we should reach them"
            />,
        );
        expect(screen.getByText('Choose how we should reach them').getAttribute('data-tone')).toBe('error');
        const radio = screen.getByRole('radio', { name: 'Contact them directly' });
        expect(radio.getAttribute('aria-describedby')).toBe(screen.getByText('We email them today').id);
    });

    test('a disabled option cannot be chosen', () => {
        render(
            <RadioGroupField
                options={[
                    { value: 'card', label: 'Card on file', disabled: true },
                    { value: 'cash', label: 'Pay at pickup' },
                ]}
                value=""
                onChange={() => {}}
            />,
        );
        const card = screen.getByLabelText('Card on file') as HTMLInputElement;
        expect(card.disabled).toBe(true);
        expect(card.parentElement?.hasAttribute('data-disabled')).toBe(true);
    });
});

describe('RadioCardsField', () => {
    const plans = [
        {
            value: 'regular',
            label: 'Regular',
            description: (
                <ul>
                    <li>One site</li>
                </ul>
            ),
        },
        {
            value: 'pro',
            label: 'Pro',
            description: (
                <ul>
                    <li>Five sites</li>
                    <li>
                        <a href="#terms">Terms</a>
                    </li>
                </ul>
            ),
        },
    ];

    function Cards({ onValue }: { onValue?: (v: string) => void }) {
        const [value, setValue] = useState('');
        return (
            <RadioCardsField
                label="Plan"
                options={plans}
                value={value}
                onChange={(v) => {
                    setValue(v);
                    onValue?.(v);
                }}
            />
        );
    }

    test('a card is named by its title and described by its rich content', () => {
        render(<Cards />);
        const pro = screen.getByRole('radio', { name: 'Pro' });
        const description = document.getElementById(pro.getAttribute('aria-describedby')!)!;
        expect(description.tagName).toBe('DIV');
        expect(description.querySelectorAll('li')).toHaveLength(2);
    });

    test('a click anywhere on the card chooses it, but links keep their own click', () => {
        const seen: string[] = [];
        render(<Cards onValue={(v) => seen.push(v)} />);
        fireEvent.click(screen.getByText('Five sites'));
        expect(seen).toEqual(['pro']);
        expect((screen.getByRole('radio', { name: 'Pro' }) as HTMLInputElement).checked).toBe(true);
        expect(document.activeElement).toBe(screen.getByRole('radio', { name: 'Pro' }));
        fireEvent.click(screen.getByText('Terms'));
        expect(seen).toEqual(['pro']);
    });

    test('cards and plain options style through their own slots', () => {
        const skin: FieldSkin = {
            classNames: { radio: 'plain', radioCard: 'card', radioCards: 'grid', radioCardLabel: 'title', radioLabel: 'text' },
        };
        render(
            <FieldSkinProvider skin={skin}>
                <Cards />
            </FieldSkinProvider>,
        );
        expect(screen.getByRole('radiogroup').className).toBe('grid');
        expect(screen.getByText('Pro').className).toBe('title');
        expect(screen.getByText('Pro').parentElement?.className).toBe('card');
    });
});

describe('composition', () => {
    test('parts take your own elements and render functions', () => {
        function Custom() {
            const [value, setValue] = useState('');
            return (
                <RadioGroup value={value} onChange={setValue} name="tier">
                    <RadioGroupLabel>Tier</RadioGroupLabel>
                    <RadioCards render={<section data-own="" />}>
                        <RadioCard value="pro" render={(props, state) => <article {...props} data-on={state.checked} />}>
                            <RadioLabel render={<label data-title="" />}>Pro</RadioLabel>
                            <RadioDescription>
                                <p>$20 a month</p>
                            </RadioDescription>
                        </RadioCard>
                    </RadioCards>
                </RadioGroup>
            );
        }
        render(<Custom />);
        const group = screen.getByRole('radiogroup', { name: 'Tier' });
        expect(group.tagName).toBe('SECTION');
        const radio = screen.getByRole('radio', { name: 'Pro' }) as HTMLInputElement;
        expect(radio.name).toBe('tier');
        fireEvent.click(screen.getByText('$20 a month'));
        expect(radio.closest('article')?.getAttribute('data-on')).toBe('true');
    });

    test('the hook alone drives fully custom markup', () => {
        function Bare() {
            const [value, setValue] = useState<'s' | 'm' | ''>('');
            const g = useRadioGroup({ value, onChange: setValue });
            return (
                <fieldset {...g.getGroupProps()}>
                    <legend {...g.getLabelProps()}>Size</legend>
                    {(['s', 'm'] as const).map((v) => (
                        <span key={v} {...g.getItemProps({ value: v })}>
                            <input {...g.getInputProps({ value: v })} />
                            <label {...g.getOptionLabelProps({ value: v })}>{v.toUpperCase()}</label>
                        </span>
                    ))}
                </fieldset>
            );
        }
        render(<Bare />);
        fireEvent.click(screen.getByLabelText('M'));
        expect((screen.getByLabelText('M') as HTMLInputElement).checked).toBe(true);
        expect(screen.getByRole('radiogroup', { name: 'Size' })).toBeTruthy();
    });
});

describe('SegmentedChoice', () => {
    const statuses = [
        { value: 'new', label: 'New', icon: <svg data-testid="icon-new" /> },
        { value: 'heard', label: 'Heard' },
        { value: 'done', label: 'Resolved', disabled: true },
    ] as const;

    function Segmented({ onValue, required }: { onValue?: (v: string) => void; required?: boolean }) {
        const [value, setValue] = useState<'new' | 'heard' | 'done' | ''>('new');
        return (
            <>
                <SegmentedChoice
                    label="Status"
                    name="status"
                    options={statuses}
                    value={value}
                    required={required}
                    onChange={(v) => {
                        setValue(v);
                        onValue?.(v);
                    }}
                />
                <button type="button">after</button>
            </>
        );
    }

    test('a labelled radiogroup of native radios, named by their labels', () => {
        render(<Segmented />);
        const group = screen.getByRole('radiogroup', { name: 'Status' });
        expect(group.getAttribute('data-slot')).toBe('segments');
        const radios = screen.getAllByRole('radio') as HTMLInputElement[];
        expect(radios.map((r) => r.type)).toEqual(['radio', 'radio', 'radio']);
        expect(radios.every((r) => r.name === 'status')).toBe(true);
        expect(screen.getByRole('radio', { name: 'New' })).toBe(radios[0]);
        expect(radios[0].checked).toBe(true);
        // The radio dot is hidden but the input stays in the tab order.
        expect(radios[0].style.position).toBe('absolute');
        expect(radios[0].tabIndex).not.toBe(-1);
    });

    test('icons are decorative and sit inside the label', () => {
        render(<Segmented />);
        const icon = screen.getByTestId('icon-new').parentElement!;
        expect(icon.getAttribute('data-slot')).toBe('segmentIcon');
        expect(icon.getAttribute('aria-hidden')).toBe('true');
        expect(icon.closest('label')?.getAttribute('data-slot')).toBe('segmentLabel');
    });

    test('a click anywhere on a segment chooses it; a disabled one cannot be chosen', () => {
        const seen: string[] = [];
        render(<Segmented onValue={(v) => seen.push(v)} />);
        const heard = screen.getByRole('radio', { name: 'Heard' }) as HTMLInputElement;
        fireEvent.click(heard.closest('[data-slot="segment"]')!);
        expect(seen).toEqual(['heard']);
        expect(heard.closest('[data-slot="segment"]')?.hasAttribute('data-checked')).toBe(true);
        const done = screen.getByRole('radio', { name: 'Resolved' }) as HTMLInputElement;
        expect(done.disabled).toBe(true);
        fireEvent.click(done.closest('[data-slot="segment"]')!);
        expect(seen).toEqual(['heard']);
    });

    test('shares the field frame: required feedback and server errors', () => {
        render(<SegmentedChoice label="Type" options={statuses} value="" onChange={() => {}} serverError="Pick a type" />);
        const group = screen.getByRole('radiogroup', { name: 'Type' });
        expect(group.getAttribute('aria-invalid')).toBe('true');
        expect(group.getAttribute('aria-describedby')).toBe(screen.getByText('Pick a type').id);
    });

    test('styles through its own slots', () => {
        const skin: FieldSkin = {
            classNames: { segments: 'row', segment: 'seg', segmentLabel: 'text', segmentInput: 'dot', segmentIcon: 'ico', radio: 'plain' },
        };
        render(
            <FieldSkinProvider skin={skin}>
                <Segmented />
            </FieldSkinProvider>,
        );
        expect(screen.getByRole('radiogroup').className).toBe('row');
        const heard = screen.getByRole('radio', { name: 'Heard' });
        expect(heard.className).toBe('dot');
        expect(heard.parentElement?.className).toBe('seg');
        expect(screen.getByText('Heard').className).toBe('text');
        expect(screen.getByTestId('icon-new').parentElement?.className).toBe('ico');
    });
});
