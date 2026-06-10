'use client';

import React, { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { Folder, Image, Trash2, Edit2, MoreVertical, Check, X } from 'lucide-react';
import { ApiCategory } from '@/types';
import { useUpdateCategory, useDeleteCategory } from '@/hooks/useCategories';
import { formatDate } from '@/lib/utils';

interface CategoryCardProps {
  category: ApiCategory;
  onClick?: () => void;
}

export function CategoryCard({ category, onClick }: CategoryCardProps) {
  const updateCategory = useUpdateCategory();
  const deleteCategory = useDeleteCategory();
  const [menuOpen, setMenuOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState(category.name);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [menuOpen]);

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm(`Delete category "${category.name}" and all its images?`)) {
      deleteCategory.mutate(category.id);
    }
    setMenuOpen(false);
  };

  const handleSaveEdit = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (editName.trim() && editName.trim() !== category.name) {
      updateCategory.mutate({ id: category.id, name: editName.trim() });
    }
    setEditing(false);
  };

  const handleCancelEdit = (e: React.MouseEvent) => {
    e.stopPropagation();
    setEditName(category.name);
    setEditing(false);
  };

  return (
    <div className={`group glass-card glass-card-hover rounded-2xl ${menuOpen ? 'relative z-30' : ''}`}>
      <div className="rounded-t-2xl overflow-hidden">
      {/* Color banner */}
      <div
        className="h-1.5 w-full"
        style={{ background: `linear-gradient(90deg, ${category.color}, transparent)` }}
      />

      {/* Thumbnail grid */}
      <Link href={`/dashboard/${category.id}`} onClick={onClick}>
        <div className="relative h-32 bg-[#0d1117] overflow-hidden cursor-pointer">
          {category.thumbnails.length > 0 ? (
            <div className="grid grid-cols-2 gap-0.5 h-full">
              {category.thumbnails.slice(0, 4).map((thumb, i) => (
                <div key={i} className="relative overflow-hidden bg-[#161b22]">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={thumb}
                    alt=""
                    className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity"
                  />
                </div>
              ))}
              {category.thumbnails.length < 4 &&
                Array.from({ length: 4 - category.thumbnails.length }).map((_, i) => (
                  <div key={`empty-${i}`} className="bg-[#0d1117]" />
                ))}
            </div>
          ) : (
            <div className="flex items-center justify-center h-full">
              <Folder size={40} className="text-[#21262d]" />
            </div>
          )}

          {category.imageCount > 4 && (
            <div className="absolute bottom-2 right-2 bg-black/70 rounded-md px-2 py-0.5 text-xs text-[#8b949e]">
              +{category.imageCount - 4} more
            </div>
          )}
          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
            <span className="text-xs text-white font-semibold">Open folder</span>
          </div>
        </div>
      </Link>
      </div>

      {/* Info */}
      <div className="px-4 py-3">
        <div className="flex items-start justify-between gap-2">
          {editing ? (
            <div className="flex items-center gap-1.5 flex-1" onClick={(e) => e.stopPropagation()}>
              <input
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                className="flex-1 bg-[#0d1117] border border-[#58a6ff] rounded-lg text-sm text-[#e6edf3] px-2 py-1 focus:outline-none"
                autoFocus
              />
              <button onClick={handleSaveEdit} className="text-[#3fb950] hover:text-[#56d364]">
                <Check size={14} />
              </button>
              <button onClick={handleCancelEdit} className="text-[#f85149] hover:text-[#ff7b72]">
                <X size={14} />
              </button>
            </div>
          ) : (
            <h3 className="font-semibold text-[#e6edf3] text-sm truncate flex-1">
              {category.name}
            </h3>
          )}

          <div ref={menuRef} className="relative flex-shrink-0" onClick={(e) => e.stopPropagation()}>
            <button
              onClick={() => setMenuOpen(!menuOpen)}
              className={`p-1 rounded-lg text-[#8b949e] hover:text-[#e6edf3] hover:bg-[#21262d] transition-colors ${menuOpen ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}
            >
              <MoreVertical size={15} />
            </button>
            {menuOpen && (
                <div className="absolute right-0 top-full mt-1 w-40 glass-card rounded-xl border border-[#21262d] shadow-xl z-20 overflow-hidden fade-in">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setEditing(true);
                      setMenuOpen(false);
                    }}
                    className="w-full flex items-center gap-2 px-3 py-2 text-xs text-[#8b949e] hover:text-[#e6edf3] hover:bg-[#21262d] transition-colors"
                  >
                    <Edit2 size={13} /> Rename
                  </button>
                  <button
                    onClick={handleDelete}
                    className="w-full flex items-center gap-2 px-3 py-2 text-xs text-[#f85149] hover:bg-[#21262d] transition-colors"
                  >
                    <Trash2 size={13} /> Delete
                  </button>
                </div>
            )}
          </div>
        </div>

        {category.description && (
          <p className="text-xs text-[#8b949e] mt-1 truncate">{category.description}</p>
        )}

        <div className="flex items-center justify-between mt-2">
          <div className="flex items-center gap-1.5 text-xs text-[#8b949e]">
            <Image size={11} />
            <span>{category.imageCount} image{category.imageCount !== 1 ? 's' : ''}</span>
          </div>
          <span className="text-xs text-[#8b949e]">{formatDate(category.createdAt)}</span>
        </div>
      </div>
    </div>
  );
}
