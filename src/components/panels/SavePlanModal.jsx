import { useEffect, useRef, useState } from 'react';
import Button from '../ui/Button.jsx';
import Input from '../ui/Input.jsx';
import Modal from '../ui/Modal.jsx';

export default function SavePlanModal({ initialName = '', open, title = 'Save plan', onClose, onSave }) {
  const [name, setName] = useState(initialName);
  const inputRef = useRef(null);

  useEffect(() => {
    if (open) {
      setName(initialName);
      const timeoutId = window.setTimeout(() => inputRef.current?.select(), 0);
      return () => window.clearTimeout(timeoutId);
    }
  }, [initialName, open]);

  function submit(event) {
    event.preventDefault();
    onSave(name);
  }

  return (
    <Modal title={title} open={open} onClose={onClose}>
      <form className="space-y-4" onSubmit={submit}>
        <label className="block text-sm font-medium">
          Name
          <Input
            autoFocus
            ref={inputRef}
            className="mt-1 w-full"
            value={name}
            aria-label="Saved plan name"
            onChange={(event) => setName(event.target.value)}
          />
        </label>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit">Save</Button>
        </div>
      </form>
    </Modal>
  );
}
