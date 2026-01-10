import React from 'react';
import { motion } from 'framer-motion';
import { Check } from 'lucide-react';

export interface Step {
    id: string;
    label: string;
}

interface StepWizardProps {
    steps: Step[];
    currentStep: number;
    completedSteps: number[];
    onStepClick?: (stepIndex: number) => void;
}

export function StepWizard({ steps, currentStep, completedSteps, onStepClick }: StepWizardProps) {
    return (
        <div className="w-full py-4">
            <div className="flex items-center justify-center gap-0">
                {steps.map((step, index) => {
                    const isCompleted = completedSteps.includes(index);
                    const isCurrent = index === currentStep;
                    const isPast = index < currentStep;
                    const isClickable = isCompleted || index <= Math.max(...completedSteps, currentStep);

                    return (
                        <React.Fragment key={step.id}>
                            {/* Step Circle */}
                            <div className="flex flex-col items-center">
                                <motion.button
                                    onClick={() => isClickable && onStepClick?.(index)}
                                    disabled={!isClickable}
                                    className={`
                                        relative w-10 h-10 rounded-full flex items-center justify-center
                                        font-bold text-sm transition-all duration-300
                                        ${isCurrent
                                            ? 'bg-[#FF0000] text-white shadow-lg shadow-red-200 scale-110'
                                            : isCompleted || isPast
                                                ? 'bg-[#FF0000] text-white'
                                                : 'bg-gray-200 text-gray-500'
                                        }
                                        ${isClickable ? 'cursor-pointer hover:scale-105' : 'cursor-not-allowed'}
                                    `}
                                    whileHover={isClickable ? { scale: 1.1 } : {}}
                                    whileTap={isClickable ? { scale: 0.95 } : {}}
                                >
                                    {isCompleted ? (
                                        <Check className="h-5 w-5" />
                                    ) : (
                                        <span>{index + 1}</span>
                                    )}
                                </motion.button>

                                {/* Step Label */}
                                <span className={`
                                    mt-2 text-xs font-medium uppercase tracking-wider
                                    ${isCurrent
                                        ? 'text-[#FF0000]'
                                        : isCompleted || isPast
                                            ? 'text-gray-700'
                                            : 'text-gray-400'
                                    }
                                `}>
                                    {step.label}
                                </span>
                            </div>

                            {/* Connector Line */}
                            {index < steps.length - 1 && (
                                <div className="flex-1 mx-2 h-1 max-w-[60px] min-w-[30px]">
                                    <div
                                        className={`
                                            h-full rounded-full transition-all duration-500
                                            ${isPast || isCompleted
                                                ? 'bg-[#FF0000]'
                                                : 'bg-gray-200'
                                            }
                                        `}
                                    />
                                </div>
                            )}
                        </React.Fragment>
                    );
                })}
            </div>
        </div>
    );
}

// Default steps for story creation
export const STORY_CREATION_STEPS: Step[] = [
    { id: 'historia', label: 'História' },
    { id: 'personagens', label: 'Personagens' },
    { id: 'narracao', label: 'Narração' },
    { id: 'cenas', label: 'Cenas' },
    { id: 'timeline', label: 'Timeline' },
    { id: 'preview', label: 'Preview' },
];
