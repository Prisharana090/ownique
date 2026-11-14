import { Suspense } from "react";
import TryOn from "./TryOn";

export default function TryOnPage() {
  return (
    <Suspense>
      <TryOn />
    </Suspense>
  );
}
