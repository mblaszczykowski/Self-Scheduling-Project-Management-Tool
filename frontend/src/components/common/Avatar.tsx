import React, { useState, useEffect } from 'react';
import { getImageUrl, getAvatarColor, getAvatarInitials } from '../../util/helpers';
import { User } from '../../types';

type AvatarSize = 'xs' | 'sm' | 'md' | 'lg';

const sizeMap: Record<AvatarSize, { container: string; text: string }> = {
    xs: { container: 'h-5 w-5', text: 'text-[10px]' },
    sm: { container: 'h-7 w-7', text: 'text-[10px]' },
    md: { container: 'h-7 w-7', text: 'text-xs' },
    lg: { container: 'h-20 w-20', text: 'text-2xl' },
};

interface AvatarProps {
    user?: User | { firstname?: string; lastname?: string } | null;
    profilePicture?: string | null;
    size?: AvatarSize;
    className?: string;
    onError?: () => void;
}

const Avatar = ({ user, profilePicture, size = 'sm', className = '', onError: externalOnError }: AvatarProps) => {
    const [hasError, setHasError] = useState(false);

    const pic = profilePicture ?? (user as User)?.profilePicture;
    const { container, text } = sizeMap[size] || sizeMap.sm;

    // A new image source should get a fresh chance to load (e.g. after a
    // profile-picture change on an already-mounted Avatar).
    useEffect(() => { setHasError(false); }, [pic]);

    const handleError = () => {
        setHasError(true);
        externalOnError?.();
    };

    if (pic && !hasError) {
        const src = pic.startsWith?.('blob:') || pic.startsWith?.('http')
            ? pic
            : getImageUrl(pic);

        return (
            <img
                src={src}
                alt={user?.firstname ? `${user.firstname} ${user.lastname || ''}`.trim() : ''}
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
