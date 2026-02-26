import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CacheService } from '@/shared/cache/cache.service';
import { OAuthAccountRepository } from '../../infrastructure/persistence/oauth-account.repository';
import { SessionRepository } from '../../infrastructure/persistence/session.repository';
import {
  generateOAuthState,
  generateCodeVerifier,
  generateCodeChallenge,
} from '@/shared/utils/crypto.util';
import { Errors } from '@/shared/exceptions/auth.exception';
import {
  OAuthUrl,
  OAuthCallbackParams,
  GoogleTokenResponse,
  GoogleUserInfo,
  AuthenticatedUser,
  Session,
} from '../../domain/types/auth.types';

/**
 * OAuth Service
 * Implements Google OAuth with PKCE
 */
@Injectable()
export class OAuthService {
  constructor(
    private readonly configService: ConfigService,
    private readonly cacheService: CacheService,
    private readonly oauthAccountRepository: OAuthAccountRepository,
    private readonly sessionRepository: SessionRepository,
  ) {}

  async getGoogleAuthUrl(): Promise<OAuthUrl> {
    const state = generateOAuthState();
    const codeVerifier = generateCodeVerifier();
    const codeChallenge = generateCodeChallenge(codeVerifier);

    const redirectUri = this.configService.get<string>('oauth.google.redirectUri') ?? '';

    await this.cacheService.createOAuthState(
      state,
      'google',
      codeVerifier,
      redirectUri,
    );

    const clientId = this.configService.get<string>('oauth.google.clientId') ?? '';

    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: 'openid email profile',
      state,
      code_challenge: codeChallenge,
      code_challenge_method: 'S256',
      access_type: 'offline',
      prompt: 'consent',
    });

    return {
      url: `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`,
      state,
    };
  }

  async handleGoogleCallback(
    params: OAuthCallbackParams,
  ): Promise<{ user: AuthenticatedUser; session: Session; isNewUser: boolean }> {
    // Consume OAuth state (one-time use via GETDEL)
    const oauthState = await this.cacheService.consumeOAuthState(params.state);

    if (!oauthState) {
      throw Errors.oauthStateInvalid();
    }

    if (oauthState.provider !== 'google') {
      throw Errors.oauthStateInvalid();
    }

    const clientId = this.configService.get<string>('oauth.google.clientId') ?? '';
    const clientSecret = this.configService.get<string>('oauth.google.clientSecret') ?? '';
    const redirectUri = this.configService.get<string>('oauth.google.redirectUri') ?? '';

    // Exchange code for tokens
    const tokenParams = new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      code: params.code,
      grant_type: 'authorization_code',
      redirect_uri: redirectUri,
      code_verifier: oauthState.codeVerifier,
    });

    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: tokenParams.toString(),
    });

    if (!tokenResponse.ok) {
      const error = await tokenResponse.text();

      throw Errors.oauthProviderError('Google', `Token exchange failed: ${error}`);
    }

    const tokens = (await tokenResponse.json()) as GoogleTokenResponse;

    // Get user info
    const userInfoResponse = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    });

    if (!userInfoResponse.ok) {
      throw Errors.oauthProviderError('Google', 'Failed to get user info');
    }

    const googleUser = (await userInfoResponse.json()) as GoogleUserInfo;

    if (!googleUser.email || !googleUser.verified_email) {
      throw Errors.oauthEmailRequired('Google');
    }

    // Find or create customer (atomic transaction)
    const { customer, isNewCustomer } = await this.oauthAccountRepository.findOrCreateCustomerByOAuth({
      provider: 'google',
      providerAccountId: googleUser.id,
      email: googleUser.email,
    });

    const session = await this.sessionRepository.create(customer.id);

    return {
      user: {
        id: customer.id,
        email: customer.email,
        first_name: customer.first_name,
        last_name: customer.last_name,
      },
      session,
      isNewUser: isNewCustomer,
    };
  }
}
