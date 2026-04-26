import { Modal, type ModalProps } from "@mantine/core";
import "./form-modal.css";

type FormModalProps = Omit<ModalProps, "title"> & {
  title: string;
  children: React.ReactNode;
};

/**
 * Themed dialog shell for in-app create/edit forms (matches app cards and tokens).
 */
export function FormModal({ title, children, classNames, size = "lg", centered = true, ...rest }: FormModalProps) {
  return (
    <Modal
      title={title}
      size={size}
      centered={centered}
      overlayProps={{ backgroundOpacity: 0.5, blur: 3 }}
      transitionProps={{ transition: "pop", duration: 180, timingFunction: "ease" }}
      classNames={{
        content: "form-modal__content",
        header: "form-modal__header",
        body: "form-modal__body",
        ...classNames,
      }}
      {...rest}
    >
      {children}
    </Modal>
  );
}
