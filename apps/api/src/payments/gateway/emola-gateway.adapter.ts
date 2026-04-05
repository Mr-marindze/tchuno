import { Injectable } from '@nestjs/common';
import { PaymentProvider } from '@prisma/client';
import { SimulatedExternalGatewayAdapter } from './simulated-external-gateway.adapter';

@Injectable()
export class EmolaGatewayAdapter extends SimulatedExternalGatewayAdapter {
  readonly provider = PaymentProvider.EMOLA;
}
