import { useEffect, useRef } from 'react';
import { Trash2 } from 'lucide-react';
import { useTimelineStore } from '../../store/index.js';
import Sidebar from '../layout/Sidebar.jsx';
import Button from '../ui/Button.jsx';
import ColorPicker from '../ui/ColorPicker.jsx';
import Input from '../ui/Input.jsx';

export default function CategoryDetailPanel({ document }) {
  const selectedCategoryId = useTimelineStore((state) => state.selectedCategoryId);
  const closeSidebar = useTimelineStore((state) => state.closeSidebar);
  const deleteCategoryWithGuard = useTimelineStore((state) => state.deleteCategoryWithGuard);
  const updateCategory = useTimelineStore((state) => state.updateCategory);
  const category = document.categories.find((item) => item.id === selectedCategoryId);
  const nameInputRef = useRef(null);

  useEffect(() => {
    if (category?.name === 'New category') {
      nameInputRef.current?.focus();
      nameInputRef.current?.select();
    }
  }, [category?.id, category?.name]);

  if (!category) {
    return (
      <Sidebar title="Category" onClose={closeSidebar}>
        <p className="text-sm text-slate-500">Select a category to edit it.</p>
      </Sidebar>
    );
  }

  return (
    <Sidebar title="Category" onClose={closeSidebar}>
      <div className="space-y-4">
        <label className="block text-sm font-medium">
          Name
          <Input
            ref={nameInputRef}
            className="mt-1 w-full"
            value={category.name}
            onChange={(event) => updateCategory(category.id, { name: event.target.value })}
          />
        </label>

        <label className="block text-sm font-medium">
          Color
          <div className="mt-2">
            <ColorPicker value={category.color} onChange={(color) => updateCategory(category.id, { color })} />
          </div>
        </label>

        <Button
          variant="ghost"
          className="w-full justify-center text-red-700 hover:text-red-800"
          onClick={() => deleteCategoryWithGuard(category.id)}
        >
          <Trash2 size={16} />
          Delete category
        </Button>
      </div>
    </Sidebar>
  );
}
