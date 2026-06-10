'use client';

import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Check, X, AlertTriangle, Cpu, Zap, Search, Tag } from 'lucide-react';
import { DetectionResult } from '@/types';
import { SATELLITE_OBJECT_CLASSES } from '@/types';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { formatConfidence } from '@/lib/utils';
import { cn } from '@/lib/utils';

const manualSchema = z.object({
  label: z.string().min(1, 'Label is required'),
});

type ManualForm = z.infer<typeof manualSchema>;

interface DetectionPanelProps {
  isVisible: boolean;
  isLoading: boolean;
  detectionResult: DetectionResult | null;
  detectionFailed: boolean;
  onConfirm: (label: string, confidence?: number) => void;
  onCancel: () => void;
}

export function DetectionPanel({
  isVisible,
  isLoading,
  detectionResult,
  detectionFailed,
  onConfirm,
  onCancel,
}: DetectionPanelProps) {
  const [useManual, setUseManual] = useState(false);
  const [selectedPreset, setSelectedPreset] = useState('');
  const [search, setSearch] = useState('');

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors },
    reset,
  } = useForm<ManualForm>({ resolver: zodResolver(manualSchema) });

  const handleConfirmDetection = () => {
    if (detectionResult) {
      onConfirm(detectionResult.label, detectionResult.confidence);
    }
  };

  const handleManualSubmit = (data: ManualForm) => {
    onConfirm(data.label);
    reset();
    setUseManual(false);
    setSelectedPreset('');
  };

  const handleCancel = () => {
    setUseManual(false);
    setSelectedPreset('');
    setSearch('');
    reset();
    onCancel();
  };

  const filteredClasses = SATELLITE_OBJECT_CLASSES.filter((c) =>
    c.toLowerCase().includes(search.toLowerCase())
  );

  if (!isVisible) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={handleCancel} />
      <div className="relative glass-card rounded-2xl w-full max-w-sm shadow-2xl fade-in border border-[#21262d]">
        {/* Header */}
        <div className="px-5 py-4 border-b border-[#21262d] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Cpu size={18} className="text-[#58a6ff]" />
            <h3 className="font-semibold text-[#e6edf3]">Object Detection</h3>
          </div>
          <button
            onClick={handleCancel}
            className="text-[#8b949e] hover:text-[#e6edf3] transition-colors p-1 rounded-lg hover:bg-[#21262d]"
          >
            <X size={16} />
          </button>
        </div>

        <div className="p-5">
          {/* Loading state */}
          {isLoading && (
            <div className="flex flex-col items-center gap-4 py-6">
              <div className="relative w-16 h-16">
                <div className="absolute inset-0 rounded-full border-2 border-[rgba(88,166,255,0.2)] animate-ping" />
                <div className="absolute inset-2 rounded-full border-2 border-[#58a6ff] border-t-transparent animate-spin" />
                <Zap size={20} className="absolute inset-0 m-auto text-[#58a6ff]" />
              </div>
              <div className="text-center">
                <p className="text-sm font-medium text-[#e6edf3]">Running Models</p>
                <p className="text-xs text-[#8b949e] mt-1">SAM2 segmentation + YOLO/Segformer detection</p>
              </div>
              <div className="w-full space-y-2">
                {['SAM2 Segmentation', 'YOLO Detection', 'Segformer Analysis'].map((step) => (
                  <div key={step} className="flex items-center gap-2">
                    <div className="w-4 h-4 rounded-full border border-[#58a6ff] flex items-center justify-center flex-shrink-0">
                      <div className="w-1.5 h-1.5 rounded-full bg-[#58a6ff] pulse-glow" />
                    </div>
                    <span className="text-xs text-[#8b949e]">{step}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Detection result */}
          {!isLoading && detectionResult && !useManual && (
            <div className="space-y-4">
              <div className="flex items-start gap-3 p-3 rounded-xl bg-[rgba(63,185,80,0.08)] border border-[rgba(63,185,80,0.2)]">
                <Check size={18} className="text-[#3fb950] mt-0.5 flex-shrink-0" />
                <div className="flex-1">
                  <p className="text-sm font-semibold text-[#e6edf3]">{detectionResult.label}</p>
                  <div className="flex items-center gap-2 mt-1 flex-wrap">
                    <Badge variant="green">
                      {formatConfidence(detectionResult.confidence)} confidence
                    </Badge>
                    <Badge variant={detectionResult.model === 'yolo' ? 'blue' : 'purple'}>
                      {detectionResult.model.toUpperCase()}
                    </Badge>
                  </div>
                </div>
              </div>

              <div className="flex gap-2">
                <Button onClick={handleConfirmDetection} className="flex-1" icon={<Check size={15} />}>
                  Confirm
                </Button>
                <Button
                  variant="secondary"
                  onClick={() => setUseManual(true)}
                  className="flex-1"
                >
                  Override
                </Button>
              </div>
            </div>
          )}

          {/* Detection failed */}
          {!isLoading && detectionFailed && !useManual && (
            <div className="space-y-4">
              <div className="flex items-start gap-3 p-3 rounded-xl bg-[rgba(210,153,34,0.08)] border border-[rgba(210,153,34,0.2)]">
                <AlertTriangle size={18} className="text-[#d29922] mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-sm font-semibold text-[#e6edf3]">Could not detect object</p>
                  <p className="text-xs text-[#8b949e] mt-1">
                    Neither YOLO nor Segformer identified this region. Please label it manually.
                  </p>
                </div>
              </div>
              <Button
                variant="outline"
                onClick={() => setUseManual(true)}
                className="w-full"
                icon={<Tag size={15} />}
              >
                Label Manually
              </Button>
            </div>
          )}

          {/* Manual input */}
          {!isLoading && useManual && (
            <form onSubmit={handleSubmit(handleManualSubmit)} className="space-y-3">
              <p className="text-xs text-[#8b949e]">Choose from common satellite objects or type a custom label</p>

              {/* Search & preset picker */}
              <div className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#8b949e]" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search classes..."
                  className="w-full bg-[#0d1117] border border-[#21262d] rounded-lg text-sm text-[#e6edf3] placeholder:text-[#8b949e] pl-8 pr-4 py-2 focus:outline-none focus:border-[#58a6ff] transition-colors"
                />
              </div>

              <div className="flex flex-wrap gap-1.5 max-h-28 overflow-y-auto">
                {filteredClasses.map((cls) => (
                  <button
                    key={cls}
                    type="button"
                    onClick={() => {
                      setSelectedPreset(cls);
                      setValue('label', cls);
                    }}
                    className={cn(
                      'px-2.5 py-1 rounded-lg text-xs font-medium border transition-all',
                      selectedPreset === cls
                        ? 'bg-[rgba(88,166,255,0.2)] border-[rgba(88,166,255,0.5)] text-[#58a6ff]'
                        : 'bg-[#161b22] border-[#21262d] text-[#8b949e] hover:border-[#58a6ff] hover:text-[#e6edf3]'
                    )}
                  >
                    {cls}
                  </button>
                ))}
              </div>

              <div>
                <input
                  placeholder="Or type custom label..."
                  className={cn(
                    'w-full bg-[#0d1117] border rounded-lg text-sm text-[#e6edf3] placeholder:text-[#8b949e] px-4 py-2.5 focus:outline-none focus:border-[#58a6ff] transition-colors',
                    errors.label ? 'border-[#f85149]' : 'border-[#21262d]'
                  )}
                  {...register('label')}
                />
                {errors.label && (
                  <p className="text-xs text-[#f85149] mt-1">{errors.label.message}</p>
                )}
              </div>

              <div className="flex gap-2">
                <Button type="submit" className="flex-1" icon={<Check size={15} />}>
                  Apply Label
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => {
                    if (detectionResult) setUseManual(false);
                    else handleCancel();
                  }}
                >
                  Back
                </Button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

