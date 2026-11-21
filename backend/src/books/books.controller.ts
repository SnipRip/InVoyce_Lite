import { Controller, Get, Query } from '@nestjs/common';
import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';
import { RequireAccess } from '../common/decorators/require-access.decorator.js';
import { todayInIndia } from '../common/dates.js';
import { financialYearOf } from '../common/financial-year.js';
import { IsIsoDate } from '../common/dto/field-validators.js';
import type { LedgerStatement } from './book-vouchers.js';
import { BooksService, type BalanceSheetView, type BankCashBalanceView, type BookLedgerView, type ProfitAndLossView, type TrialBalanceView } from './books.service.js';

class AsOfQueryDto {
  /** Defaults to today in India. */
  @IsOptional()
  @IsIsoDate('Pick the date')
  asOf?: string;
}

class StatementQueryDto {
  @IsString()
  @IsNotEmpty({ message: 'Pick the ledger' })
  @MaxLength(120)
  ledger!: string;

  /** Defaults to 1 April of the financial year of `to`. */
  @IsOptional()
  @IsIsoDate('Pick the first day')
  from?: string;

  /** Defaults to today in India. */
  @IsOptional()
  @IsIsoDate('Pick the last day')
  to?: string;
}

/** The three statements share one permission: they show the whole books. */
export const BOOKS_MODULE = '/financial-statements';

@Controller('books')
export class BooksController {
  constructor(private readonly books: BooksService) {}

  @RequireAccess(BOOKS_MODULE, 'view')
  @Get('trial-balance')
  trialBalance(@Query() query: AsOfQueryDto): Promise<TrialBalanceView> {
    return this.books.trialBalance(query.asOf ?? todayInIndia());
  }

  @RequireAccess(BOOKS_MODULE, 'view')
  @Get('profit-and-loss')
  profitAndLoss(@Query() query: AsOfQueryDto): Promise<ProfitAndLossView> {
    return this.books.profitAndLoss(query.asOf ?? todayInIndia());
  }

  @RequireAccess(BOOKS_MODULE, 'view')
  @Get('balance-sheet')
  balanceSheet(@Query() query: AsOfQueryDto): Promise<BalanceSheetView> {
    return this.books.balanceSheet(query.asOf ?? todayInIndia());
  }

  /** Balances move with entries, so they show to whoever may see the bank & cash master. */
  @RequireAccess('/masters/bank-cash', 'view')
  @Get('bank-cash-balances')
  bankCashBalances(@Query() query: AsOfQueryDto): Promise<BankCashBalanceView[]> {
    return this.books.bankCashBalances(query.asOf ?? todayInIndia());
  }

  @RequireAccess(BOOKS_MODULE, 'view')
  @Get('ledgers')
  ledgers(@Query() query: AsOfQueryDto): Promise<BookLedgerView[]> {
    return this.books.ledgers(query.asOf ?? todayInIndia());
  }

  /** A ledger statement; the cash book and bank book are the statements of those ledgers. */
  @RequireAccess(BOOKS_MODULE, 'view')
  @Get('ledger-statement')
  ledgerStatement(@Query() query: StatementQueryDto): Promise<LedgerStatement> {
    const to = query.to ?? todayInIndia();
    const from = query.from ?? `${financialYearOf(to).slice(0, 4)}-04-01`;
    return this.books.ledgerStatement(query.ledger, from, to);
  }
}
