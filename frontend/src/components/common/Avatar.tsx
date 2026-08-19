import React, { useState, useEffect } from 'react';
import { AvatarSubject, getAvatarColor, getAvatarInitials, getImageUrl } from '../../util/helpers';

export type AvatarSize = 'xxs' | 'xs' | 'sm' | 'md' | 'lg';

const sizeMap: Record<AvatarSize, { container: string; text: string }> = {
    xxs: { container: 'h-4 w-4', text: 'text-[8px]' },
    xs: { container: 'h-5 w-5', text: 'text-[10px]' },
    sm: { container: 'h-7 w-7', text: 'text-[10px]' },
    md: { container: 'h-8 w-8', text: 'text-xs' },
    lg: { container: 'h-20 w-20', text: 'text-2xl' },
};

interface AvatarProps {
    user?: AvatarSubject | null;
    profilePicture?: string | null;
    size?: AvatarSize;
    className?: string;
    onError?: () => void;
}

const Avatar = ({ user, profilePicture, size = 'sm', className = '', onError: externalOnError }: AvatarProps) => {
    const [hasError, setHasError] = useState(false);

    const pic = profilePicture ?? user?.profilePicture;
    const { container, text } = sizeMap[size];

    useEffect(() => { setHasError(false); }, [pic]);

    const handleError = () => {
        setHasError(true);
        externalOnError?.();
    };

    if (pic && !hasError) {
        const src = pic.startsWith('blob:') || pic.startsWith('http')
            ? pic
            : getImageUrl(pic);

        return (
            <img
                src={src}
                alt={user?.firstname ? `${user.firstname} ${user.lastname ?? ''}`.trim() : user?.email ?? ''}
                className={`${container} rounded-full object-cover ${className}`}
                onError={handleError}
            />
        );
    }

    return (
        <div
            className={`${container} rounded-full bg-gradient-to-br ${getAvatarColor(user)} flex items-center justify-center ${className}`}
        >
            <span className={`${text} font-semibold text-white`}>
                {getAvatarInitials(user)}
            </span>
        </div>
    );
};

export default React.memo(Avatar);
