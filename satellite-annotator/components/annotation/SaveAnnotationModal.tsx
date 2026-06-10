'use client';

import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { FolderPlus, Save, Check, Loader2 } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { useCategories, useCreateCategory } from '@/hooks/useCategories';
import { getApiErrorMessage } from '@/lib/errors';
import { cn } from '@/lib/utils';

const newCatSchema = z.object({
  name: z.string().min(1, 'Category name is required').max(50),
  description: z.string().max(200).optional(),
});

type NewCatForm = z.infer<typeof newCatSchema>;

interface SaveAnnotationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (categoryId: string) => Promise<void>;
  imageName: string;
  isSaving?: boolean;
  saveError?: string;
}

export function SaveAnnotationModal({
  isOpen,
  onClose,
  onSave,
  imageName,
  isSaving = false,
  saveError = '',
}: SaveAnnotationModalProps) {
  const { data: categories = [], isLoading } = useCategories();
  const createCategory = useCreateCategory();
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [showNewForm, setShowNewForm] = useState(false);
  const [createError, setCreateError] = useState('');

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm<NewCatForm>({ resolver: zodResolver(newCatSchema) });

  const handleCreateCategory = async (data: NewCatForm) => {
    setCreateError('');
    try {
      const cat = await createCategory.mutateAsync({ name: data.name, description: data.description });
      setSelectedCategoryId(cat.id);
      setShowNewForm(false);
      reset();
    } catch (err: unknown) {
      const message = getApiErrorMessage(err);
      if (message) setCreateError(message);
    }
  };

  const handleSave = async () => {
    if (!selectedCategoryId) return;
    await onSave(selectedCategoryId);
    setSelectedCategoryId(null);
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Save Annotation" size="md">
      <div className="space-y-4">
        <p className="text-sm text-[#8b949e]">
          Saving <span className="text-[#e6edf3] font-medium">{imageName}</span> — choose or create a category.
        </p>

        {isLoading ? (
          <div className="flex items-center justify-center py-6">
            <Loader2 size={20} className="animate-spin text-[#58a6ff]" />
          </div>
        ) : categories.length > 0 ? (
          <div className="space-y-2">
            <p className="text-xs font-semibold text-[#8b949e] uppercase tracking-wide">
              Existing Categories
            </p>
            <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto pr-1">
              {categories.map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => setSelectedCategoryId(cat.id)}
                  className={cn(
                    'flex items-center gap-2 px-3 py-2.5 rounded-xl border text-left transition-all',
                    selectedCategoryId === cat.id
                      ? 'border-[rgba(88,166,255,0.5)] bg-[rgba(88,166,255,0.1)]'
                      : 'border-[#21262d] bg-[#0d1117] hover:border-[#30363d]'
                  )}
                >
                  <div
                    className="w-3 h-3 rounded-sm flex-shrink-0"
                    style={{ backgroundColor: cat.color }}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-[#e6edf3] truncate">{cat.name}</p>
                    <p className="text-xs text-[#8b949e]">{cat.imageCount} images</p>
                  </div>
                  {selectedCategoryId === cat.id && (
                    <Check size={14} className="text-[#58a6ff] flex-shrink-0" />
                  )}
                </button>
              ))}
            </div>
          </div>
        ) : null}

        {showNewForm ? (
          <form
            onSubmit={handleSubmit(handleCreateCategory)}
            className="space-y-3 border border-[#21262d] rounded-xl p-4 bg-[#0d1117]"
          >
            <p className="text-sm font-semibold text-[#e6edf3]">New Category</p>
            <Input
              label="Name"
              placeholder="e.g. Urban Structures"
              error={errors.name?.message}
              {...register('name')}
            />
            <Input
              label="Description (optional)"
              placeholder="Brief description..."
              error={errors.description?.message}
              {...register('description')}
            />
            {createError && (
              <div className="p-3 rounded-lg bg-[rgba(248,81,73,0.1)] border border-[rgba(248,81,73,0.3)] text-sm text-[#f85149]">
                {createError}
              </div>
            )}
            <div className="flex gap-2">
              <Button
                type="submit"
                size="sm"
                icon={<Check size={14} />}
                loading={createCategory.isPending}
              >
                Create
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => { setShowNewForm(false); setCreateError(''); }}
              >
                Cancel
              </Button>
            </div>
          </form>
        ) : (
          <button
            onClick={() => setShowNewForm(true)}
            className="w-full flex items-center gap-2 px-4 py-3 rounded-xl border border-dashed border-[#21262d] text-[#8b949e] hover:text-[#58a6ff] hover:border-[rgba(88,166,255,0.4)] transition-all text-sm"
          >
            <FolderPlus size={16} />
            Create new category
          </button>
        )}

        {saveError && (
          <div className="p-3 rounded-lg bg-[rgba(248,81,73,0.1)] border border-[rgba(248,81,73,0.3)] text-sm text-[#f85149]">
            {saveError}
          </div>
        )}

        <Button
          onClick={handleSave}
          disabled={!selectedCategoryId || isSaving}
          size="lg"
          className="w-full"
          icon={isSaving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
          loading={isSaving}
        >
          {isSaving ? 'Saving...' : 'Save Annotation'}
        </Button>
      </div>
    </Modal>
  );
}
