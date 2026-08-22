import { useCallback, useEffect, useState } from 'react'
import { num } from '@/lib/money'

export interface CartItem {
  variant_id: string
  sku: string
  name: string
  size?: string
  color_name?: string
  color_hex?: string
  unit_price: number
  quantity: number
  discount: number
}

interface ParkedTicket {
  id: string
  items: CartItem[]
  timestamp: number
  customer_id?: string
  discount_code?: string
  manual_discount: number
}

const CART_STORAGE_KEY = 'vitality.pos.cart'
const PARKED_STORAGE_KEY = 'vitality.pos.parked'

export function useCart() {
  const [items, setItems] = useState<CartItem[]>([])
  const [parkedTickets, setParkedTickets] = useState<ParkedTicket[]>([])

  // Load from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(CART_STORAGE_KEY)
      if (stored) {
        setItems(JSON.parse(stored))
      }

      const parked = localStorage.getItem(PARKED_STORAGE_KEY)
      if (parked) {
        setParkedTickets(JSON.parse(parked))
      }
    } catch (err) {
      console.error('Error loading cart from localStorage:', err)
    }
  }, [])

  // Save to localStorage whenever items change
  useEffect(() => {
    try {
      localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(items))
    } catch (err) {
      console.error('Error saving cart to localStorage:', err)
    }
  }, [items])

  // Save parked tickets whenever they change
  useEffect(() => {
    try {
      localStorage.setItem(PARKED_STORAGE_KEY, JSON.stringify(parkedTickets))
    } catch (err) {
      console.error('Error saving parked tickets to localStorage:', err)
    }
  }, [parkedTickets])

  const addItem = useCallback(
    (item: CartItem, availableQuantity: number) => {
      setItems((prev) => {
        const existing = prev.find((x) => x.variant_id === item.variant_id)

        if (existing) {
          // Increment quantity, but cap at available stock
          const newQuantity = Math.min(
            existing.quantity + item.quantity,
            availableQuantity
          )
          return prev.map((x) =>
            x.variant_id === item.variant_id
              ? { ...x, quantity: newQuantity }
              : x
          )
        }

        // New item, cap quantity at available stock
        return [
          ...prev,
          { ...item, quantity: Math.min(item.quantity, availableQuantity) },
        ]
      })
    },
    []
  )

  const updateQuantity = useCallback(
    (variant_id: string, quantity: number, availableQuantity: number) => {
      setItems((prev) => {
        if (quantity <= 0) {
          return prev.filter((x) => x.variant_id !== variant_id)
        }

        const capped = Math.min(quantity, availableQuantity)
        return prev.map((x) =>
          x.variant_id === variant_id ? { ...x, quantity: capped } : x
        )
      })
    },
    []
  )

  const updateDiscount = useCallback((variant_id: string, discount: number) => {
    setItems((prev) =>
      prev.map((x) => {
        if (x.variant_id === variant_id) {
          const lineTotal = num(x.unit_price) * x.quantity
          return { ...x, discount: Math.min(Math.max(0, discount), lineTotal) }
        }
        return x
      })
    )
  }, [])

  const removeItem = useCallback((variant_id: string) => {
    setItems((prev) => prev.filter((x) => x.variant_id !== variant_id))
  }, [])

  const clear = useCallback(() => {
    setItems([])
  }, [])

  const parkTicket = useCallback(
    (customerId?: string, discountCode?: string, manualDiscount: number = 0) => {
      if (items.length === 0) return

      const id = `parked-${Date.now()}`
      const ticket: ParkedTicket = {
        id,
        items: [...items],
        timestamp: Date.now(),
        customer_id: customerId,
        discount_code: discountCode,
        manual_discount: manualDiscount,
      }

      setParkedTickets((prev) => [...prev, ticket])
      setItems([])

      return id
    },
    [items]
  )

  const resumeTicket = useCallback((id: string) => {
    let resumedTicket: ParkedTicket | undefined
    setParkedTickets((prev) => {
      const ticket = prev.find((x) => x.id === id)
      if (ticket) {
        resumedTicket = ticket
        setItems([...ticket.items])
        return prev.filter((x) => x.id !== id)
      }
      return prev
    })
    return resumedTicket
  }, [])

  const deleteParkedTicket = useCallback((id: string) => {
    setParkedTickets((prev) => prev.filter((x) => x.id !== id))
  }, [])

  const reconcileAgainstStock = useCallback(
    (
      availableByVariantId: Record<string, number>,
      priceByVariantId?: Record<string, number>
    ) => {
      setItems((prev) => {
        let changed = false
        const updated = prev.filter((item) => {
          const available = availableByVariantId[item.variant_id] || 0
          if (available === 0) {
            changed = true
            return false // Remove items with no stock
          }
          return true
        }).map((item) => {
          const available = availableByVariantId[item.variant_id] || 0
          let next = item
          if (item.quantity > available) {
            changed = true
            next = { ...next, quantity: available }
          }
          // Pick up a price change made elsewhere (e.g. Products page)
          // while this item is already sitting in the cart.
          const currentPrice = priceByVariantId?.[item.variant_id]
          if (currentPrice !== undefined && currentPrice !== num(next.unit_price)) {
            changed = true
            next = { ...next, unit_price: currentPrice }
          }
          return next
        })
        return changed ? updated : prev
      })
    },
    []
  )

  const subtotal = items.reduce(
    (sum, item) => sum + num(item.unit_price) * item.quantity,
    0
  )
  const totalDiscount = items.reduce((sum, item) => sum + num(item.discount), 0)
  const grandTotal = subtotal - totalDiscount

  return {
    items,
    parkedTickets,
    subtotal,
    totalDiscount,
    grandTotal,
    addItem,
    updateQuantity,
    updateDiscount,
    removeItem,
    clear,
    parkTicket,
    resumeTicket,
    deleteParkedTicket,
    reconcileAgainstStock,
  }
}
