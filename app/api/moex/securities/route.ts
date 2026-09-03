import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const url = 'https://iss.moex.com/iss/engines/futures/markets/forts/securities.json?iss.only=securities&iss.meta=off&securities.columns=SECID,SHORTNAME,LATNAME,SECNAME,PREVSETTLEPRICE,MINSTEP,STEPPRICE';
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'application/json'
      },
      next: { revalidate: 300 }
    });

    if (!res.ok) {
      return NextResponse.json({ error: `MOEX error: ${res.status}` }, { status: res.status });
    }

    const data = await res.json();
    const rows = data.securities?.data || [];
    const list = rows.map((row: any[]) => ({
      ticker: row[0],
      name: (row[1] || row[3] || row[2] || '').slice(0, 50),
      source: 'moex',
      type: 'ФОРТС'
    }));

    return NextResponse.json({ list });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
