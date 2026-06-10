'use client';

import React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Satellite,
  Zap,
  Layers,
  Tag,
  FolderOpen,
  Shield,
  ArrowRight,
  Star,
  Globe,
  Cpu,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { useCurrentUser } from '@/hooks/useAuth';

const features = [
  {
    icon: <Cpu size={22} className="text-[#58a6ff]" />,
    title: 'SAM2 Segmentation',
    description: 'Click-based interactive segmentation using Meta\'s Segment Anything Model 2.',
    color: '#58a6ff',
  },
  {
    icon: <Zap size={22} className="text-[#bc8cff]" />,
    title: 'YOLO + Segformer',
    description: 'Dual-model object detection automatically identifies and labels satellite features.',
    color: '#bc8cff',
  },
  {
    icon: <Tag size={22} className="text-[#3fb950]" />,
    title: 'Manual Override',
    description: 'When AI models are uncertain, easily label objects manually from preset classes.',
    color: '#3fb950',
  },
  {
    icon: <Layers size={22} className="text-[#ffa657]" />,
    title: 'Multi-layer Annotations',
    description: 'Stack multiple annotations on a single image with color-coded polygon overlays.',
    color: '#ffa657',
  },
  {
    icon: <FolderOpen size={22} className="text-[#f0883e]" />,
    title: 'Category Management',
    description: 'Organize annotated images into custom categories and folders.',
    color: '#f0883e',
  },
  {
    icon: <Shield size={22} className="text-[#d29922]" />,
    title: 'Secure & Private',
    description: 'Your annotations stay local — no data leaves your browser.',
    color: '#d29922',
  },
];

const stats = [
  { value: '< 1s', label: 'Segmentation time' },
  { value: '2', label: 'Detection models' },
  { value: '18+', label: 'Object classes' },
];

export default function HomePage() {
  const { data: user } = useCurrentUser();
  const router = useRouter();

  return (
    <div className="min-h-screen">
      {/* Hero */}
      <section className="relative pt-32 pb-20 px-4 sm:px-6 lg:px-8 overflow-hidden">
        {/* Orbit decoration */}
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full border border-[rgba(88,166,255,0.06)] pointer-events-none" />
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] h-[400px] rounded-full border border-[rgba(188,140,255,0.06)] pointer-events-none" />
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[200px] h-[200px] rounded-full border border-[rgba(88,166,255,0.08)] pointer-events-none" />

        <div className="max-w-4xl mx-auto text-center fade-in">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[rgba(88,166,255,0.1)] border border-[rgba(88,166,255,0.2)] text-[#58a6ff] text-sm font-medium mb-6">
            <Globe size={14} className="pulse-glow" />
            AI-Powered Satellite Annotation
          </div>

          <h1 className="text-5xl sm:text-6xl lg:text-7xl font-extrabold text-[#e6edf3] leading-tight mb-6">
            Annotate{' '}
            <span className="gradient-text glow-text-blue">Satellite</span>
            <br />
            Imagery with AI
          </h1>

          <p className="text-lg sm:text-xl text-[#8b949e] max-w-2xl mx-auto mb-10 leading-relaxed">
            Powered by SAM2 segmentation, YOLO and Segformer detection — click any object
            on a satellite image to instantly segment and identify it.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            {user ? (
              <>
                <Button
                  size="lg"
                  onClick={() => router.push('/annotate')}
                  icon={<Satellite size={20} />}
                  iconRight={<ArrowRight size={16} />}
                  className="min-w-[200px]"
                >
                  Start Annotating
                </Button>
                <Button
                  size="lg"
                  variant="secondary"
                  onClick={() => router.push('/dashboard')}
                  icon={<FolderOpen size={18} />}
                >
                  My Dashboard
                </Button>
              </>
            ) : (
              <>
                <Link href="/auth/signup">
                  <Button
                    size="lg"
                    icon={<Satellite size={20} />}
                    iconRight={<ArrowRight size={16} />}
                    className="min-w-[200px]"
                  >
                    Get Started Free
                  </Button>
                </Link>
                <Link href="/auth/signin">
                  <Button size="lg" variant="secondary">
                    Sign In
                  </Button>
                </Link>
              </>
            )}
          </div>
        </div>

        {/* Stats */}
        <div className="max-w-3xl mx-auto mt-20 grid grid-cols-2 sm:grid-cols-3 gap-4">
          {stats.map((stat) => (
            <div
              key={stat.label}
              className="glass-card rounded-2xl p-4 text-center border border-[#21262d]"
            >
              <p className="text-2xl font-bold gradient-text">{stat.value}</p>
              <p className="text-xs text-[#8b949e] mt-1">{stat.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Features */}
      <section className="py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-14">
            <h2 className="text-3xl sm:text-4xl font-bold text-[#e6edf3] mb-4">
              Everything you need for{' '}
              <span className="gradient-text">satellite annotation</span>
            </h2>
            <p className="text-[#8b949e] max-w-xl mx-auto">
              From one-click segmentation to organized categories — a complete toolkit for remote sensing teams.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {features.map((feat) => (
              <div
                key={feat.title}
                className="glass-card glass-card-hover rounded-2xl p-6 border border-[#21262d]"
              >
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center mb-4"
                  style={{ background: `${feat.color}15`, border: `1px solid ${feat.color}30` }}
                >
                  {feat.icon}
                </div>
                <h3 className="font-semibold text-[#e6edf3] mb-2">{feat.title}</h3>
                <p className="text-sm text-[#8b949e] leading-relaxed">{feat.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-2xl mx-auto text-center">
          <div className="glass-card rounded-3xl p-10 border border-[rgba(88,166,255,0.2)] glow-blue">
            <Star size={32} className="text-[#58a6ff] mx-auto mb-4 pulse-glow" />
            <h2 className="text-3xl font-bold text-[#e6edf3] mb-4">
              Ready to annotate?
            </h2>
            <p className="text-[#8b949e] mb-8">
              Upload your first satellite image and start labeling objects with AI assistance.
            </p>
            {user ? (
              <Button
                size="lg"
                onClick={() => router.push('/annotate')}
                iconRight={<ArrowRight size={16} />}
              >
                Open Annotation Tool
              </Button>
            ) : (
              <Link href="/auth/signup">
                <Button size="lg" iconRight={<ArrowRight size={16} />}>
                  Create Free Account
                </Button>
              </Link>
            )}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-[#21262d] py-8 px-4 text-center">
        <div className="flex items-center justify-center gap-2 mb-2">
          <Satellite size={16} className="text-[#58a6ff]" />
          <span className="text-sm font-semibold text-[#e6edf3]">OrbitAnnotate</span>
        </div>
        <p className="text-xs text-[#8b949e]">
          AI-powered satellite imagery annotation • SAM2 • YOLO • Segformer
        </p>
      </footer>
    </div>
  );
}
