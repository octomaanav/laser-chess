import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { deleteSetup, isDefault, listSetups, saveSetup } from '@/server/setupStore';
import { validateSetup } from '@/game/setups';
import { COOKIE, verifySession } from '@/server/adminAuth';
import type { SetupDef } from '@/game/types';

export const dynamic = 'force-dynamic';

async function requireAdmin(): Promise<boolean> {
  const jar = await cookies();
  return !!verifySession(jar.get(COOKIE)?.value);
}

// Public: the lobby needs the list of setup names.
export function GET() {
  return NextResponse.json({ setups: listSetups() });
}

export async function POST(req: Request) {
  if (!(await requireAdmin())) return NextResponse.json({ error: 'admin login required' }, { status: 401 });
  let body: SetupDef;
  try {
    body = (await req.json()) as SetupDef;
  } catch {
    return NextResponse.json({ error: 'invalid JSON' }, { status: 400 });
  }
  const name = String(body?.name || '').trim().slice(0, 24);
  if (!name || !Array.isArray(body.pieces)) {
    return NextResponse.json({ error: 'name and pieces[] are required' }, { status: 400 });
  }
  const def: SetupDef = { name, pieces: body.pieces };
  const v = validateSetup(def);
  if (v.errors.length) return NextResponse.json({ error: v.errors.join('; ') }, { status: 400 });
  saveSetup(def);
  return NextResponse.json({ ok: true, setups: listSetups() });
}

export async function DELETE(req: Request) {
  if (!(await requireAdmin())) return NextResponse.json({ error: 'admin login required' }, { status: 401 });
  const name = new URL(req.url).searchParams.get('name') || '';
  if (isDefault(name)) return NextResponse.json({ error: 'cannot delete a built-in setup' }, { status: 400 });
  if (name) deleteSetup(name);
  return NextResponse.json({ ok: true, setups: listSetups() });
}
