import { createRoot } from 'react-dom/client';
import { useState } from 'react';
import { files, MB } from '../../src/core';
import { phone } from '../../src/definitions';
import {
    Field,
    FieldSkinProvider,
    FileDropField,
    FilePickerField,
    RadioCardsField,
    RadioGroupField,
    useFileField,
    type FieldSkin,
} from '../../src/dom';

// A plain-CSS skin, only so the browser check can see focus and drag states.
const skin: FieldSkin = {
    classNames: {
        trigger: 'trigger',
        dropArea: 'drop',
        fileItem: 'item',
        fileRejection: 'rejection',
        radioCard: 'card',
        radioCardInput: 'card-input',
    },
};
const artwork = files({ accept: ['image/*', '.pdf', '.md'], maxSize: 10 * MB, maxFiles: 3, requiredMessage: 'Add artwork' });

function Picker() {
    const [value, setValue] = useState<File[]>([]);
    return <FilePickerField id="picker" definition={artwork} label="Artwork" value={value} onChange={setValue} required name="artwork[]" />;
}

function Drop() {
    const [value, setValue] = useState<File[]>([]);
    return <FileDropField id="drop" definition={artwork} label="Directions" value={value} onChange={setValue} />;
}

function Custom() {
    const [value, setValue] = useState<File[]>([]);
    const f = useFileField(files({ accept: ['.pdf'] }), { id: 'custom', value, onChange: setValue });
    return (
        <div {...f.getRootProps()}>
            <span {...f.getLabelProps()}>Poster</span>
            <button type="button" id="own-button" onClick={f.open}>Browse with my button</button>
            <label {...f.getTriggerProps()}>
                <input {...f.getInputProps()} /> Upload PDF
            </label>
            <div {...f.getAnnouncerProps()}>{f.announcement}</div>
        </div>
    );
}

function Decider() {
    const [value, setValue] = useState<'yes' | 'no' | ''>('');
    return (
        <RadioGroupField
            id="decider"
            name="decider"
            label="Are you the person who decides on this?"
            options={[
                { value: 'yes', label: 'Yes' },
                { value: 'no', label: 'No' },
            ]}
            value={value}
            onChange={setValue}
            required
        />
    );
}

function Plans() {
    const [value, setValue] = useState('');
    return (
        <RadioCardsField
            id="plan"
            name="plan"
            label="Plan"
            options={[
                { value: 'regular', label: 'Regular', description: <ul><li>One site</li></ul> },
                {
                    value: 'pro',
                    label: 'Pro',
                    description: (
                        <ul>
                            <li>Five sites</li>
                            <li><a href="#terms" id="terms">Terms</a></li>
                        </ul>
                    ),
                },
            ]}
            value={value}
            onChange={setValue}
        />
    );
}

// A floating label, made only of skin: the label sits in the box while it is
// empty and unfocused, and shrinks to the top edge otherwise. The hint is
// moved below the box with a flex order; the markup is the stock Field.
const floating: FieldSkin = {
    classNames: {
        root: 'float',
        label: 'float-label',
        hint: 'float-hint',
        control: 'float-control',
        input: 'float-input',
        message: 'float-message',
    },
};

function Floating() {
    const [value, setValue] = useState('');
    return (
        <FieldSkinProvider skin={floating}>
            <Field id="floating" definition={phone} value={value} onChange={setValue} hint="Mobile preferred" />
        </FieldSkinProvider>
    );
}

createRoot(document.getElementById('root')!).render(
    <FieldSkinProvider skin={skin}>
        <form id="form" onSubmit={(e) => e.preventDefault()}>
            <Picker />
            <Drop />
            <Custom />
            <button type="button" id="radio-before">before</button>
            <Decider />
            <button type="button" id="radio-after">after</button>
            <Plans />
            <Floating />
        </form>
    </FieldSkinProvider>,
);
