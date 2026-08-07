'use client';
import { useEffect, useState } from 'react';

export default function Toast({ toast }: { toast: { id: number; text: string } | null }) {
  const [show, setShow] = useState(false);
  const [text, setText] = useState('');

  useEffect(() => {
    if (!toast) return;
    setText(toast.text);
    setShow(true);
    const t = setTimeout(() => setShow(false), 2200);
    return () => clearTimeout(t);
  }, [toast]);

  return <div className={`toast${show ? ' show' : ''}`}>{text}</div>;
}
