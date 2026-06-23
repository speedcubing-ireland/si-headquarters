import type { ComponentProps, ReactNode } from "react"
import { useState } from "react"
import {
  ArrowUpRight,
  Clock3,
  Gavel,
  Info,
  ShieldCheck,
  Timer,
  AlertTriangle,
} from "lucide-react"
import type { SponsorBidStatus } from "@/convex/plugins/sponsor/lib/sponsorBidStatus"
import { currencyInputLabel } from "@/plugins/sponsor/lib/sponsorship-ui"
import { SponsorBidStatusBadge } from "@/plugins/sponsor/components/sponsor-bid-status-badge"
import {
  SponsorMetricTile,
  SponsorMutedPanel,
} from "@/plugins/sponsor/components/sponsor-metric-tile"
import { STAT_CARD_EMPHASIS_CLASS } from "@/lib/theme-constants"
import {
  SponsorButtonSpinner,
  SponsorFeatureIcon,
} from "@/plugins/sponsor/components/sponsor-ui"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge, type badgeVariants } from "@/components/ui/badge"
import type { VariantProps } from "class-variance-authority"
import { Button } from "@/components/ui/button"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogMedia,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Field, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Separator } from "@/components/ui/separator"

type BadgeVariant = NonNullable<VariantProps<typeof badgeVariants>["variant"]>

export interface AuctionSummaryMetric {
  label: string
  value: string
}

export interface AuctionBidActivityItem {
  id: string
  sponsorLabel: string
  amountLabel: string
  isOwnBid: boolean
  typeLabel: string
  createdAtLabel: string
}

interface AuctionBiddingSummaryCardProps {
  stateLabel: string
  stateVariant: BadgeVariant
  helpTitle: string
  onHelpClick?: () => void
  closesAtText: string
  priceLabel: string
  priceValue: string
  sponsorBidStatus?: SponsorBidStatus
  personalMetricLabel?: string
  personalMetricText?: string
  metrics?: AuctionSummaryMetric[]
}

export function AuctionProxyHeroStatusCard({
  currentPriceLabel,
  currentPriceText,
  closesAtText,
  isClosingSoon = false,
  sponsorBidStatus,
  myMaxBidText,
}: {
  currentPriceLabel: string
  currentPriceText: string
  closesAtText: string
  isClosingSoon?: boolean
  sponsorBidStatus?: SponsorBidStatus
  myMaxBidText: string
}) {
  return (
    <Card>
      <CardContent className="grid gap-6 py-6 sm:grid-cols-2 sm:items-start">
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">{currentPriceLabel}</p>
          <p className="text-4xl font-bold tracking-tight tabular-nums">
            {currentPriceText}
          </p>
          <Badge variant={isClosingSoon ? "destructive" : "secondary"}>
            <Timer className="size-3.5" aria-hidden />
            {closesAtText}
          </Badge>
        </div>
        <div className="space-y-3 sm:text-right">
          <p className="text-sm text-muted-foreground sm:sr-only">
            Your status
          </p>
          <div className="flex flex-wrap items-center gap-2 sm:justify-end">
            <SponsorBidStatusBadge status={sponsorBidStatus} showDot />
          </div>
          <div className="space-y-1 sm:ml-auto sm:max-w-xs">
            <p className="text-sm text-muted-foreground">Your secret max bid</p>
            <p className="text-xl font-semibold tabular-nums">{myMaxBidText}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

export function AuctionBiddingSummaryCard({
  stateLabel,
  stateVariant,
  helpTitle,
  onHelpClick,
  closesAtText,
  priceLabel,
  priceValue,
  sponsorBidStatus,
  personalMetricLabel,
  personalMetricText,
  metrics,
}: AuctionBiddingSummaryCardProps) {
  return (
    <Card className="overflow-hidden">
      <CardHeader className="gap-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant={stateVariant}>{stateLabel}</Badge>
              <SponsorBidStatusBadge status={sponsorBidStatus} showDot />
            </div>
            <div>
              <CardDescription>Auction status</CardDescription>
              <CardTitle className="text-2xl tabular-nums sm:text-3xl">
                {priceValue}
              </CardTitle>
              <p className="mt-1 text-sm text-muted-foreground">{priceLabel}</p>
            </div>
          </div>
          {onHelpClick ? (
            <Button type="button" variant="outline" onClick={onHelpClick}>
              <Info className="size-4" />
              {helpTitle}
            </Button>
          ) : null}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {metrics !== undefined && metrics.length > 0 ? (
          <div className="space-y-3">
            <SponsorMetricTile label="Deadline">
              {closesAtText}
            </SponsorMetricTile>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {metrics.map((metric) => (
                <SponsorMetricTile
                  key={metric.label}
                  label={metric.label}
                  valueClassName="tabular-nums"
                >
                  {metric.value}
                </SponsorMetricTile>
              ))}
            </div>
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-3">
            <SponsorMetricTile label="Deadline">
              {closesAtText}
            </SponsorMetricTile>
            <SponsorMetricTile label={priceLabel} valueClassName="tabular-nums">
              {priceValue}
            </SponsorMetricTile>
            {personalMetricLabel !== undefined &&
            personalMetricText !== undefined ? (
              <SponsorMetricTile
                label={personalMetricLabel}
                valueClassName="tabular-nums"
              >
                {personalMetricText}
              </SponsorMetricTile>
            ) : null}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

interface AuctionAmountFormConfig {
  title: string
  description: string
  minimumLabel: string
  minimumValue: string
  minimumHint?: string
  inputId: string
  inputLabel: string
  inputValue: string
  inputMin: string
  inputStep?: string
  inputPlaceholder?: string
  helperText?: ReactNode
  onInputChange: (value: string) => void
  onSubmit: NonNullable<ComponentProps<"form">["onSubmit"]>
  submitLabel: string
  isSubmitting?: boolean
  submitIcon?: ReactNode
}

function AuctionAmountForm({
  title,
  description,
  minimumLabel,
  minimumValue,
  minimumHint,
  inputId,
  inputLabel,
  inputValue,
  inputMin,
  inputStep = "0.01",
  inputPlaceholder,
  helperText,
  onInputChange,
  onSubmit,
  submitLabel,
  isSubmitting = false,
  submitIcon,
}: AuctionAmountFormConfig) {
  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(12rem,auto)]">
        <div>
          <h3 className="text-base font-semibold">{title}</h3>
          <p className="mt-1 text-sm text-muted-foreground">{description}</p>
        </div>
        <SponsorMetricTile
          label={minimumLabel}
          align="right"
          valueClassName="text-lg font-semibold tabular-nums"
        >
          {minimumValue}
          {minimumHint !== undefined && minimumHint.length > 0 ? (
            <p className="mt-1 text-xs font-normal text-muted-foreground">
              {minimumHint}
            </p>
          ) : null}
        </SponsorMetricTile>
      </div>
      <form className="grid gap-3 sm:grid-cols-[1fr_auto]" onSubmit={onSubmit}>
        <Field>
          <FieldLabel htmlFor={inputId}>{inputLabel}</FieldLabel>
          <Input
            id={inputId}
            type="number"
            min={inputMin}
            step={inputStep}
            value={inputValue}
            onChange={(event) => {
              onInputChange(event.target.value)
            }}
            placeholder={inputPlaceholder}
            disabled={isSubmitting}
            className="h-11 text-base tabular-nums"
          />
          {helperText !== undefined ? (
            <p className="text-sm text-muted-foreground">{helperText}</p>
          ) : null}
        </Field>
        <div className="flex items-end">
          <Button
            type="submit"
            className="h-11 w-full sm:min-w-36"
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <SponsorButtonSpinner />
            ) : (
              <>
                {submitIcon}
                {submitLabel}
              </>
            )}
          </Button>
        </div>
      </form>
    </div>
  )
}

interface AuctionBidConfirmation {
  open: boolean
  title: string
  description: string
  amountLabel: string
  amountValue: string
  detailLabel: string
  detailValue: string
  confirmLabel: string
  isSubmitting: boolean
  icon: ReactNode
  onOpenChange: (open: boolean) => void
  onConfirm: () => void
}

function AuctionBidConfirmationDialog({
  open,
  title,
  description,
  amountLabel,
  amountValue,
  detailLabel,
  detailValue,
  confirmLabel,
  isSubmitting,
  icon,
  onOpenChange,
  onConfirm,
}: AuctionBidConfirmation) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogMedia>{icon}</AlertDialogMedia>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <div className="grid gap-2 rounded-md border bg-muted/20 p-3 text-sm">
          <div className="flex items-center justify-between gap-4">
            <span className="text-muted-foreground">{amountLabel}</span>
            <span className="font-semibold tabular-nums">{amountValue}</span>
          </div>
          <Separator />
          <div className="flex items-center justify-between gap-4">
            <span className="text-muted-foreground">{detailLabel}</span>
            <span className="text-right font-medium">{detailValue}</span>
          </div>
        </div>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isSubmitting}>Cancel</AlertDialogCancel>
          <AlertDialogAction disabled={isSubmitting} onClick={onConfirm}>
            {isSubmitting ? <SponsorButtonSpinner /> : confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

export function AuctionBiddingActionCard({
  bidForm,
  sealedNotice,
  confirmation,
}: {
  bidForm: AuctionAmountFormConfig
  sealedNotice?: ReactNode
  confirmation?: AuctionBidConfirmation
}) {
  return (
    <>
      <Card className={STAT_CARD_EMPHASIS_CLASS}>
        <CardHeader>
          <div className="flex items-start gap-3">
            <SponsorFeatureIcon icon={Gavel} />
            <div className="min-w-0">
              <CardTitle>Bid on this sponsorship</CardTitle>
              <CardDescription>
                Your bid is hidden during the auction and can be updated before
                close.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {sealedNotice !== undefined ? (
            <Alert>
              <ShieldCheck className="size-4" />
              <AlertTitle>Sealed bid</AlertTitle>
              <AlertDescription>{sealedNotice}</AlertDescription>
            </Alert>
          ) : null}
          <AuctionAmountForm {...bidForm} />
        </CardContent>
      </Card>
      {confirmation !== undefined ? (
        <AuctionBidConfirmationDialog {...confirmation} />
      ) : null}
    </>
  )
}

interface ProxyCompactBidFormProps {
  inputId: string
  inputLabel: string
  inputValue: string
  inputMin: string
  inputPlaceholder?: string
  minimumHint: string
  submitLabel: string
  submitIcon?: ReactNode
  isSubmitting?: boolean
  onInputChange: (value: string) => void
  onSubmit: NonNullable<ComponentProps<"form">["onSubmit"]>
}

function ProxyCompactBidForm({
  inputId,
  inputLabel,
  inputValue,
  inputMin,
  inputPlaceholder,
  minimumHint,
  submitLabel,
  submitIcon,
  isSubmitting = false,
  onInputChange,
  onSubmit,
}: ProxyCompactBidFormProps) {
  return (
    <form className="space-y-3" onSubmit={onSubmit}>
      <Field>
        <FieldLabel htmlFor={inputId}>{inputLabel}</FieldLabel>
        <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
          <Input
            id={inputId}
            type="number"
            min={inputMin}
            step="0.01"
            value={inputValue}
            onChange={(event) => {
              onInputChange(event.target.value)
            }}
            placeholder={inputPlaceholder}
            disabled={isSubmitting}
            className="h-11 text-base tabular-nums"
          />
          <Button
            type="submit"
            className="h-11 w-full sm:min-w-36"
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <SponsorButtonSpinner />
            ) : (
              <>
                {submitIcon}
                {submitLabel}
              </>
            )}
          </Button>
        </div>
        <p className="text-sm text-muted-foreground">{minimumHint}</p>
      </Field>
    </form>
  )
}

function AuctionRaiseVisiblePriceDialog({
  open,
  onOpenChange,
  amountEuros,
  minimumNextBidText,
  minimumNextBidEuros,
  directBidSubmitLabel,
  isSubmitting,
  isConfirmationOpen,
  onAmountChange,
  onSubmit,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  amountEuros: string
  minimumNextBidText: string
  minimumNextBidEuros: string
  directBidSubmitLabel: string
  isSubmitting: boolean
  isConfirmationOpen: boolean
  onAmountChange: (value: string) => void
  onSubmit: NonNullable<ComponentProps<"form">["onSubmit"]>
}) {
  return (
    <Dialog open={open && !isConfirmationOpen} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button type="button" variant="outline">
          Bid again while winning
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Raise visible price</DialogTitle>
          <DialogDescription>
            Increase the current auction price that everyone sees.
          </DialogDescription>
        </DialogHeader>
        <Alert variant="destructive">
          <AlertTriangle className="size-4" />
          <AlertTitle>You are already winning</AlertTitle>
          <AlertDescription>
            Raising the visible price increases the current auction price for
            everyone, effectively bidding against your own proxy.
          </AlertDescription>
        </Alert>
        <ProxyCompactBidForm
          inputId="raise-visible-bid"
          inputLabel={currencyInputLabel("Bid amount")}
          inputValue={amountEuros}
          inputMin={minimumNextBidEuros}
          inputPlaceholder={minimumNextBidEuros}
          minimumHint={`Minimum next bid: ${minimumNextBidText}`}
          submitLabel={directBidSubmitLabel}
          submitIcon={<ArrowUpRight className="size-4" />}
          isSubmitting={isSubmitting}
          onInputChange={onAmountChange}
          onSubmit={onSubmit}
        />
        <DialogFooter className="sm:justify-end">
          <DialogClose asChild>
            <Button type="button" variant="ghost" disabled={isSubmitting}>
              Cancel
            </Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export function AuctionProxyBiddingPanels({
  minimumNextBidText,
  amountEuros,
  maxAmountEuros,
  minimumNextBidEuros,
  directBidTitle,
  directBidDescription,
  directBidSubmitLabel,
  maxBidTitle,
  maxBidDescription,
  maxBidSubmitLabel,
  statusNotice,
  sponsorBidStatus,
  isSubmittingNormalBid,
  isSubmittingMaxBid,
  normalBidConfirmation,
  maxBidConfirmation,
  onAmountChange,
  onMaxAmountChange,
  onSubmitNormalBid,
  onSubmitMaxBid,
}: {
  minimumNextBidText: string
  amountEuros: string
  maxAmountEuros: string
  minimumNextBidEuros: string
  directBidTitle: string
  directBidDescription: string
  directBidSubmitLabel: string
  maxBidTitle: string
  maxBidDescription: string
  maxBidSubmitLabel: string
  statusNotice: ReactNode
  sponsorBidStatus?: SponsorBidStatus
  isSubmittingNormalBid: boolean
  isSubmittingMaxBid: boolean
  normalBidConfirmation?: AuctionBidConfirmation
  maxBidConfirmation?: AuctionBidConfirmation
  onAmountChange: (value: string) => void
  onMaxAmountChange: (value: string) => void
  onSubmitNormalBid: NonNullable<ComponentProps<"form">["onSubmit"]>
  onSubmitMaxBid: NonNullable<ComponentProps<"form">["onSubmit"]>
}) {
  const isWinning = sponsorBidStatus === "winning"
  const maxBidMinimumHint = `Minimum allowed max bid is ${minimumNextBidText}`
  const [raiseVisibleOpen, setRaiseVisibleOpen] = useState(false)

  if (isWinning) {
    return (
      <>
        <Card className={STAT_CARD_EMPHASIS_CLASS}>
          <CardHeader>
            <div className="flex items-start gap-3">
              <SponsorFeatureIcon icon={ShieldCheck} />
              <div className="min-w-0">
                <CardTitle>Manage proxy bid</CardTitle>
                <CardDescription>{statusNotice}</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <ProxyCompactBidForm
              inputId="max-bid"
              inputLabel={currencyInputLabel("Update secret max bid")}
              inputValue={maxAmountEuros}
              inputMin={minimumNextBidEuros}
              inputPlaceholder={minimumNextBidEuros}
              minimumHint={maxBidMinimumHint}
              submitLabel={maxBidSubmitLabel}
              submitIcon={<ShieldCheck className="size-4" />}
              isSubmitting={isSubmittingMaxBid}
              onInputChange={onMaxAmountChange}
              onSubmit={onSubmitMaxBid}
            />
            <AuctionRaiseVisiblePriceDialog
              open={raiseVisibleOpen}
              onOpenChange={setRaiseVisibleOpen}
              amountEuros={amountEuros}
              minimumNextBidText={minimumNextBidText}
              minimumNextBidEuros={minimumNextBidEuros}
              directBidSubmitLabel={directBidSubmitLabel}
              isSubmitting={isSubmittingNormalBid}
              isConfirmationOpen={normalBidConfirmation?.open ?? false}
              onAmountChange={onAmountChange}
              onSubmit={(event) => {
                onSubmitNormalBid(event)
                setRaiseVisibleOpen(false)
              }}
            />
          </CardContent>
        </Card>
        {normalBidConfirmation !== undefined ? (
          <AuctionBidConfirmationDialog {...normalBidConfirmation} />
        ) : null}
        {maxBidConfirmation !== undefined ? (
          <AuctionBidConfirmationDialog {...maxBidConfirmation} />
        ) : null}
      </>
    )
  }

  return (
    <>
      <Card className={STAT_CARD_EMPHASIS_CLASS}>
        <CardHeader>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex items-start gap-3">
              <SponsorFeatureIcon icon={Gavel} />
              <div className="min-w-0">
                <CardTitle>{directBidTitle}</CardTitle>
                <CardDescription>{directBidDescription}</CardDescription>
              </div>
            </div>
            <SponsorBidStatusBadge status={sponsorBidStatus} showDot />
          </div>
        </CardHeader>
        <CardContent>
          <ProxyCompactBidForm
            inputId="normal-bid"
            inputLabel={currencyInputLabel("Bid amount")}
            inputValue={amountEuros}
            inputMin={minimumNextBidEuros}
            inputPlaceholder={minimumNextBidEuros}
            minimumHint={`Minimum next bid: ${minimumNextBidText}`}
            submitLabel={directBidSubmitLabel}
            submitIcon={<ArrowUpRight className="size-4" />}
            isSubmitting={isSubmittingNormalBid}
            onInputChange={onAmountChange}
            onSubmit={onSubmitNormalBid}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-start gap-3">
            <SponsorFeatureIcon icon={ShieldCheck} />
            <div className="min-w-0">
              <CardTitle>{maxBidTitle}</CardTitle>
              <CardDescription>{maxBidDescription}</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert>
            <Info className="size-4" />
            <AlertDescription>{statusNotice}</AlertDescription>
          </Alert>
          <ProxyCompactBidForm
            inputId="max-bid"
            inputLabel={currencyInputLabel("Secret max bid")}
            inputValue={maxAmountEuros}
            inputMin={minimumNextBidEuros}
            inputPlaceholder={minimumNextBidEuros}
            minimumHint={maxBidMinimumHint}
            submitLabel={maxBidSubmitLabel}
            submitIcon={<ShieldCheck className="size-4" />}
            isSubmitting={isSubmittingMaxBid}
            onInputChange={onMaxAmountChange}
            onSubmit={onSubmitMaxBid}
          />
        </CardContent>
      </Card>

      {normalBidConfirmation !== undefined ? (
        <AuctionBidConfirmationDialog {...normalBidConfirmation} />
      ) : null}
      {maxBidConfirmation !== undefined ? (
        <AuctionBidConfirmationDialog {...maxBidConfirmation} />
      ) : null}
    </>
  )
}

export function AuctionUnavailableCard({ message }: { message: ReactNode }) {
  return (
    <Card>
      <CardContent className="flex items-start gap-3 py-4 text-sm text-muted-foreground">
        <Clock3 className="mt-0.5 size-4 shrink-0" aria-hidden />
        <div>{message}</div>
      </CardContent>
    </Card>
  )
}

interface AuctionBidActivityCardProps {
  description: ReactNode
  isProxyAuction: boolean
  bidHistoryVisible: boolean
  items: AuctionBidActivityItem[]
  sealedMessage: string
  unavailableMessage: string
  emptyMessage: string
}

export function AuctionBidActivityCard({
  description,
  isProxyAuction,
  bidHistoryVisible,
  items,
  sealedMessage,
  unavailableMessage,
  emptyMessage,
}: AuctionBidActivityCardProps) {
  const announcement = !isProxyAuction
    ? sealedMessage
    : !bidHistoryVisible
      ? unavailableMessage
      : null

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ShieldCheck className="size-4" />
          Bid Activity
        </CardTitle>
        <CardDescription>
          {isProxyAuction ? (
            <>
              <Clock3 className="mr-1 inline size-3.5" />
              {description}
            </>
          ) : (
            description
          )}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        {announcement !== null ? (
          <SponsorMutedPanel>{announcement}</SponsorMutedPanel>
        ) : items.length === 0 ? (
          <div className="text-sm text-muted-foreground">{emptyMessage}</div>
        ) : (
          items.map((item) => (
            <div
              key={item.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-md border px-3 py-2 text-sm"
            >
              <div className="flex items-center gap-2">
                <Badge variant={item.isOwnBid ? "default" : "secondary"}>
                  {item.sponsorLabel}
                </Badge>
                <span className="font-medium tabular-nums">
                  {item.amountLabel}
                </span>
                <Badge variant="outline">{item.typeLabel}</Badge>
              </div>
              <span className="text-xs text-muted-foreground">
                {item.createdAtLabel}
              </span>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  )
}
