import { useParams } from "react-router-dom";
import JacimentForm from "./JacimentForm";
import UEForm from "./UEForm";
import ObjecteForm from "./ObjecteForm";

export function EditJaciment() {
  const { id } = useParams();
  return <JacimentForm editId={id} />;
}

export function EditUE() {
  const { id } = useParams();
  return <UEForm editId={id} />;
}

export function EditObjecte() {
  const { id } = useParams();
  return <ObjecteForm editId={id} />;
}
