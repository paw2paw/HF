// TODO: Route disabled - schema mismatch
import { NextResponse } from 'next/server';
export async function GET() { return NextResponse.json({ ok: false, error: 'Route disabled - schema update needed' }, { status: 501 }); }
export async function POST() { return NextResponse.json({ ok: false, error: 'Route disabled - schema update needed' }, { status: 501 }); }

