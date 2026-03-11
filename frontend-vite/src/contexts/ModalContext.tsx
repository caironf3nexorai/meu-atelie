import React, { createContext, useContext, useState } from 'react';
import type { ReactNode } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

interface ModalContextType {
    showAlert: (title: string, message: string) => void;
    showConfirm: (title: string, message: string, onConfirm: () => void) => void;
}

const ModalContext = createContext<ModalContextType | undefined>(undefined);

export function ModalProvider({ children }: { children: ReactNode }) {
    const [alertOpen, setAlertOpen] = useState(false);
    const [alertData, setAlertData] = useState({ title: '', message: '' });

    const [confirmOpen, setConfirmOpen] = useState(false);
    const [confirmData, setConfirmData] = useState({ title: '', message: '' });
    const [onConfirmCallback, setOnConfirmCallback] = useState<(() => void) | null>(null);

    const showAlert = (title: string, message: string) => {
        setAlertData({ title, message });
        setAlertOpen(true);
    };

    const showConfirm = (title: string, message: string, onConfirm: () => void) => {
        setConfirmData({ title, message });
        setOnConfirmCallback(() => onConfirm);
        setConfirmOpen(true);
    };

    const handleConfirm = () => {
        if (onConfirmCallback) onConfirmCallback();
        setConfirmOpen(false);
    };

    return (
        <ModalContext.Provider value={{ showAlert, showConfirm }}>
            {children}

            <Dialog open={alertOpen} onOpenChange={setAlertOpen}>
                <DialogContent className="sm:max-w-[425px] bg-surface border-border">
                    <DialogHeader>
                        <DialogTitle className="text-text font-display text-xl">{alertData.title}</DialogTitle>
                        <DialogDescription className="text-text-light font-ui pt-2">
                            {alertData.message}
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter className="mt-4">
                        <Button onClick={() => setAlertOpen(false)} className="bg-primary hover:bg-primary-dark text-white w-full sm:w-auto px-6">
                            OK
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
                <DialogContent className="sm:max-w-[425px] bg-surface border-border">
                    <DialogHeader>
                        <DialogTitle className="text-text font-display text-xl">{confirmData.title}</DialogTitle>
                        <DialogDescription className="text-text-light font-ui pt-2">
                            {confirmData.message}
                        </DialogDescription>
                    </DialogHeader>
                    <div className="flex flex-col sm:flex-row gap-3 pt-4 sm:justify-end">
                        <Button variant="outline" onClick={() => setConfirmOpen(false)} className="border-border-light text-text-light hover:bg-surface-warm w-full sm:w-auto">
                            Cancelar
                        </Button>
                        <Button onClick={handleConfirm} className="bg-primary hover:bg-primary-dark text-white w-full sm:w-auto">
                            Confirmar
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>

        </ModalContext.Provider>
    );
}

export const useModal = () => {
    const context = useContext(ModalContext);
    if (!context) throw new Error('useModal must be used within ModalProvider');
    return context;
};
