import { NextResponse } from "next/server";

export async function PATCH() {
  return NextResponse.json({ errorCode: "deprecated" }, { status: 410 });
}

export async function DELETE() {
  return NextResponse.json({ errorCode: "deprecated" }, { status: 410 });
}
