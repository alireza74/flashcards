// Loeschen in zwei Schritten: erstes Tippen fragt nach, zweites fuehrt aus.
import { useState } from 'react';

import { Button } from '@/shared/ui/button';
import { FormMessage } from '@/shared/ui/form-message';

type ConfirmButtonProps = {
  title: string;
  confirmText: string;
  cancelTitle: string;
  onConfirm: () => void;
};

export function ConfirmButton({ title, confirmText, cancelTitle, onConfirm }: ConfirmButtonProps) {
  const [asking, setAsking] = useState(false);

  return (
    <>
      {asking ? <FormMessage tone="error" text={confirmText} /> : null}
      <Button
        variant="secondary"
        title={title}
        onPress={() => {
          if (asking) {
            setAsking(false);
            onConfirm();
          } else {
            setAsking(true);
          }
        }}
      />
      {asking ? <Button variant="link" title={cancelTitle} onPress={() => setAsking(false)} /> : null}
    </>
  );
}
