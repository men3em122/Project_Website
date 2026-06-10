'use client';

import React, { useState } from 'react';
import { Trash2, Tag, ChevronDown, ChevronUp, AlertCircle, Cpu, Crosshair } from 'lucide-react';
import { Annotation } from '@/types';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { formatConfidence } from '@/lib/utils';
import { cn } from '@/lib/utils';

interface AnnotationPanelProps {
  annotations: Annotation[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  onDelete: (id: string) => void;
}

export function AnnotationPanel({ annotations, selectedId, onSelect, onDelete }: AnnotationPanelProps) {
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  if (annotations.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-48 text-center px-4">
        <Crosshair size={32} className="text-[#21262d] mb-3" />
        <p className="text-sm text-[#8b949e]">No annotations yet</p>
        <p className="text-xs text-[#8b949e] mt-1">Click on the image to start annotating</p>
      </div>
    );
  }

  return (
    <div className="space-y-2 overflow-y-auto max-h-[calc(100vh-340px)]">
      {annotations.map((ann, idx) => {
        const isSelected = ann.id === selectedId;
        const isCollapsed = collapsed[ann.id];

        return (
          <div
            key={ann.id}
            onClick={() => onSelect(isSelected ? null : ann.id)}
            className={cn(
              'rounded-xl border transition-all cursor-pointer',
              isSelected
                ? 'border-[rgba(88,166,255,0.5)] bg-[rgba(88,166,255,0.06)]'
                : 'border-[#21262d] bg-[#0d1117] hover:border-[#30363d]'
            )}
          >
            <div className="flex items-center gap-2 px-3 py-2.5">
              {/* Color dot */}
              <div
                className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                style={{ backgroundColor: ann.color, boxShadow: `0 0 6px ${ann.color}80` }}
              />

              {/* Label */}
              <span className="text-sm font-medium text-[#e6edf3] flex-1 truncate">
                {ann.label}
              </span>

              {/* Index badge */}
              <span className="text-xs text-[#8b949e] w-5 text-right">#{idx + 1}</span>

              {/* Collapse button */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setCollapsed((prev) => ({ ...prev, [ann.id]: !prev[ann.id] }));
                }}
                className="text-[#8b949e] hover:text-[#e6edf3] transition-colors"
              >
                {isCollapsed ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
              </button>
            </div>

            {!isCollapsed && (
              <div className="px-3 pb-2.5 space-y-2 border-t border-[#21262d] pt-2 mt-0.5">
                {/* Detection info */}
                <div className="flex flex-wrap gap-1.5">
                  {ann.detectionMethod === 'auto' ? (
                    <Badge variant="green">
                      <Cpu size={10} className="mr-1" />
                      Auto-detected
                    </Badge>
                  ) : (
                    <Badge variant="yellow">
                      <Tag size={10} className="mr-1" />
                      Manual
                    </Badge>
                  )}
                  {ann.confidence && (
                    <Badge variant="blue">
                      {formatConfidence(ann.confidence)} conf.
                    </Badge>
                  )}
                </div>

                {/* Delete button */}
                <Button
                  variant="danger"
                  size="sm"
                  icon={<Trash2 size={13} />}
                  onClick={(e) => {
                    e.stopPropagation();
                    onDelete(ann.id);
                  }}
                  className="w-full"
                >
                  Remove
                </Button>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
