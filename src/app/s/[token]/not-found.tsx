import { ViewerMessage } from "@/components/viewer/ViewerStates";

export default function SurpriseNotFound() {
  return (
    <ViewerMessage
      title="We couldn't find this surprise"
      body="Check that the whole link was copied. If it's more than 30 days old, it may have ended."
    />
  );
}
