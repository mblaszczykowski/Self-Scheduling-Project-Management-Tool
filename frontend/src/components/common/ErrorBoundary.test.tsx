import { render, screen } from '@testing-library/react';
import ErrorBoundary from './ErrorBoundary';

const Bomb = ({ shouldThrow }: { shouldThrow: boolean }) => {
    if (shouldThrow) throw new Error('boom');
    return <div>safe child</div>;
};

describe('ErrorBoundary', () => {
    test('a throwing child renders the fallback instead of the error propagating', () => {
        render(
            <ErrorBoundary>
                <Bomb shouldThrow />
            </ErrorBoundary>,
        );
        expect(screen.getByText('Something went wrong')).toBeInTheDocument();
        expect(screen.queryByText('safe child')).not.toBeInTheDocument();
    });

    test('level="section" renders the section fallback, not the page fallback', () => {
        render(
            <ErrorBoundary level="section">
                <Bomb shouldThrow />
            </ErrorBoundary>,
        );
        expect(screen.getByText('This section encountered an error.')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Try Again' })).toBeInTheDocument();
    });

    test('the default (page) fallback differs from the section fallback', () => {
        render(
            <ErrorBoundary>
                <Bomb shouldThrow />
            </ErrorBoundary>,
        );
        expect(screen.getByText(/We encountered an unexpected error/)).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Refresh Page' })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Go to Home' })).toBeInTheDocument();
    });

    test('a custom fallback is rendered instead of the built-in ones', () => {
        render(
            <ErrorBoundary fallback={<div>custom fallback ui</div>}>
                <Bomb shouldThrow />
            </ErrorBoundary>,
        );
        expect(screen.getByText('custom fallback ui')).toBeInTheDocument();
        expect(screen.queryByText('Something went wrong')).not.toBeInTheDocument();
    });

    test('re-rendering with the same resetKey does not clear an existing error', () => {
        const { rerender } = render(
            <ErrorBoundary resetKey={1}>
                <Bomb shouldThrow />
            </ErrorBoundary>,
        );
        expect(screen.getByText('Something went wrong')).toBeInTheDocument();

        rerender(
            <ErrorBoundary resetKey={1}>
                <Bomb shouldThrow={false} />
            </ErrorBoundary>,
        );
        expect(screen.getByText('Something went wrong')).toBeInTheDocument();
    });

    test('changing resetKey clears the error and renders children again', () => {
        const { rerender } = render(
            <ErrorBoundary resetKey={1}>
                <Bomb shouldThrow />
            </ErrorBoundary>,
        );
        expect(screen.getByText('Something went wrong')).toBeInTheDocument();

        rerender(
            <ErrorBoundary resetKey={2}>
                <Bomb shouldThrow={false} />
            </ErrorBoundary>,
        );
        expect(screen.getByText('safe child')).toBeInTheDocument();
        expect(screen.queryByText('Something went wrong')).not.toBeInTheDocument();
    });
});
