import { useRef, useState } from 'react';
import { Download, Upload } from 'lucide-react';
import Button from '../ui/Button.jsx';
import Modal from '../ui/Modal.jsx';

export default function BackupRestoreModal({ open, onClose, onDownload, onRestore, savedPlanCount }) {
  const fileInputRef = useRef(null);
  const [selectedFile, setSelectedFile] = useState(null);

  function close() {
    setSelectedFile(null);
    onClose();
  }

  return (
    <Modal title="Backup/restore" open={open} onClose={close}>
      <div className="space-y-4">
        <section className="space-y-2 rounded border border-line p-3">
          <h3 className="text-sm font-semibold">Backup all saved plans</h3>
          <p className="text-sm text-slate-600">
            Download one JSON file containing every locally saved plan ({savedPlanCount} total).
          </p>
          <Button onClick={onDownload}>
            <Download size={16} />
            Backup all data
          </Button>
        </section>

        <section className="space-y-3 rounded border border-red-200 bg-red-50 p-3">
          <div>
            <h3 className="text-sm font-semibold text-red-950">Restore backup</h3>
            <p className="mt-1 text-sm text-red-900">
              Restoring a backup overwrites every locally saved plan currently stored in this browser.
            </p>
          </div>
          <input
            ref={fileInputRef}
            className="hidden"
            type="file"
            accept="application/json,.json"
            onChange={(event) => {
              const [file] = event.target.files ?? [];
              setSelectedFile(file ?? null);
              event.target.value = '';
            }}
          />
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="secondary" onClick={() => fileInputRef.current?.click()}>
              Choose backup file
            </Button>
            <span className="truncate text-xs text-red-900">{selectedFile?.name ?? 'No file selected'}</span>
          </div>
          <Button
            className="w-full justify-center"
            disabled={!selectedFile}
            onClick={() => {
              if (selectedFile) {
                onRestore(selectedFile);
              }
            }}
          >
            <Upload size={16} />
            Restore backup and overwrite all plans
          </Button>
        </section>

        <div className="flex justify-end">
          <Button variant="secondary" onClick={close}>
            Close
          </Button>
        </div>
      </div>
    </Modal>
  );
}
