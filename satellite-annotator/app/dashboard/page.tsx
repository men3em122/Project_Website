'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  FolderPlus,
  ImagePlus,
  Layers,
  Tag,
  TrendingUp,
  Search,
  Grid3X3,
} from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { getApiErrorMessage } from '@/lib/errors';
import { AuthGuard } from '@/components/layout/AuthGuard';
import { CategoryCard } from '@/components/dashboard/CategoryCard';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { useCurrentUser } from '@/hooks/useAuth';
import { useCategories, useCreateCategory } from '@/hooks/useCategories';

const newCatSchema = z.object({
  name: z.string().min(1, 'Category name is required').max(50),
  description: z.string().max(200).optional(),
});

type NewCatForm = z.infer<typeof newCatSchema>;

export default function DashboardPage() {
  return (
    <AuthGuard>
      <DashboardContent />
    </AuthGuard>
  );
}

function DashboardContent() {
  const router = useRouter();
  const { data: user } = useCurrentUser();
  const { data: categories = [], isLoading } = useCategories();
  const createCategory = useCreateCategory();
  const [searchQuery, setSearchQuery] = useState('');
  const [showNewCatModal, setShowNewCatModal] = useState(false);
  const [createError, setCreateError] = useState('');

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    reset,
  } = useForm<NewCatForm>({ resolver: zodResolver(newCatSchema) });

  const totalImages = categories.reduce((acc, cat) => acc + cat.imageCount, 0);
  const totalAnnotations = categories.reduce((acc, cat) => acc + cat.annotationCount, 0);

  const filteredCategories = categories.filter((cat) =>
    cat.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleCreateCategory = async (data: NewCatForm) => {
    setCreateError('');
    try {
      await createCategory.mutateAsync({ name: data.name, description: data.description });
      setShowNewCatModal(false);
      reset();
    } catch (err: unknown) {
      const message = getApiErrorMessage(err);
      if (message) setCreateError(message);
    }
  };

  return (
    <div className="min-h-screen pt-20 pb-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8 mt-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-[#e6edf3]">
              Welcome back, <span className="gradient-text capitalize">{user?.name}</span>
            </h1>
            <p className="text-[#8b949e] text-sm mt-1">
              Manage your annotated satellite imagery
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Button
              variant="secondary"
              icon={<FolderPlus size={16} />}
              onClick={() => setShowNewCatModal(true)}
            >
              New Category
            </Button>
            <Button
              icon={<ImagePlus size={16} />}
              onClick={() => router.push('/annotate')}
            >
              Annotate Image
            </Button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
          {[
            { label: 'Categories', value: categories.length, icon: <Grid3X3 size={18} className="text-[#58a6ff]" />, color: '#58a6ff' },
            { label: 'Images', value: totalImages, icon: <Layers size={18} className="text-[#bc8cff]" />, color: '#bc8cff' },
            { label: 'Annotations', value: totalAnnotations, icon: <Tag size={18} className="text-[#3fb950]" />, color: '#3fb950' },
            { label: 'Accuracy', value: '94%', icon: <TrendingUp size={18} className="text-[#ffa657]" />, color: '#ffa657' },
          ].map((stat) => (
            <div key={stat.label} className="glass-card rounded-2xl p-4 border border-[#21262d]">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-[#8b949e] font-medium">{stat.label}</span>
                <div
                  className="w-8 h-8 rounded-lg flex items-center justify-center"
                  style={{ background: `${stat.color}15`, border: `1px solid ${stat.color}30` }}
                >
                  {stat.icon}
                </div>
              </div>
              <p className="text-2xl font-bold text-[#e6edf3]">{stat.value}</p>
            </div>
          ))}
        </div>

        {/* Search */}
        <div className="mb-6">
          <Input
            placeholder="Search categories..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            leftIcon={<Search size={16} />}
            className="max-w-sm"
          />
        </div>

        {/* Categories grid */}
        {isLoading ? (
          <div className="flex items-center justify-center py-24">
            <div className="spinner" style={{ width: 32, height: 32 }} />
          </div>
        ) : filteredCategories.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            {categories.length === 0 ? (
              <>
                <div className="w-20 h-20 rounded-3xl bg-[rgba(88,166,255,0.08)] border border-[rgba(88,166,255,0.15)] flex items-center justify-center mb-4">
                  <Grid3X3 size={36} className="text-[#58a6ff]" />
                </div>
                <h3 className="text-lg font-semibold text-[#e6edf3] mb-2">No categories yet</h3>
                <p className="text-sm text-[#8b949e] max-w-xs mb-6">
                  Create a category to organize your annotated satellite images
                </p>
                <Button icon={<FolderPlus size={16} />} onClick={() => setShowNewCatModal(true)}>
                  Create First Category
                </Button>
              </>
            ) : (
              <>
                <Search size={36} className="text-[#21262d] mb-3" />
                <p className="text-[#8b949e]">No categories match &quot;{searchQuery}&quot;</p>
              </>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
            {filteredCategories.map((cat) => (
              <CategoryCard key={cat.id} category={cat} />
            ))}
          </div>
        )}
      </div>

      {/* New category modal */}
      <Modal
        isOpen={showNewCatModal}
        onClose={() => { setShowNewCatModal(false); reset(); setCreateError(''); }}
        title="New Category"
        size="sm"
      >
        <form onSubmit={handleSubmit(handleCreateCategory)} className="space-y-4">
          <Input
            label="Category Name"
            placeholder="e.g. Urban Structures"
            error={errors.name?.message}
            {...register('name')}
          />
          <Input
            label="Description (optional)"
            placeholder="What kind of objects does this contain?"
            error={errors.description?.message}
            {...register('description')}
          />
          {createError && (
            <div className="p-3 rounded-lg bg-[rgba(248,81,73,0.1)] border border-[rgba(248,81,73,0.3)] text-sm text-[#f85149]">
              {createError}
            </div>
          )}
          <div className="flex gap-2 pt-2">
            <Button type="submit" className="flex-1" loading={isSubmitting || createCategory.isPending}>
              Create Category
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={() => { setShowNewCatModal(false); reset(); }}
            >
              Cancel
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
