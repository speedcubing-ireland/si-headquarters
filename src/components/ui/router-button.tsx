import { createLink } from '@tanstack/react-router'
import { Button } from '@/components/ui/button'
import { forwardRef } from 'react'

export const RouterButton = createLink(
  forwardRef<HTMLButtonElement, React.ComponentProps<typeof Button>>((props, ref) => {
    return <Button ref={ref} {...props} />
  }),
)