import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Injectable } from '@angular/core';

import { NULL_PAGING_RESULTS, PagingOptions, PagingResults } from '../../common/paging.module';
import { SystemAlertService } from '../../common/system-alert.module';

import { of, Observable } from 'rxjs';
import { catchError, map, tap } from 'rxjs/operators';
import { AuthorizationService } from '../auth/authorization.service';
import { SessionService } from '../auth/session.service';
import { User } from '../auth/user.model';
import { TeamAuthorizationService } from './team-authorization.service';
import { TeamMember } from './team-member.model';
import { Team } from './team.model';

export interface AddedMember {
	_id: string;
	username?: string;
	role: string;
	roleDisplay: string;
}

@Injectable()
export class TeamsService {
	headers: any = { 'Content-Type': 'application/json' };

	constructor(
		private http: HttpClient,
		private sessionService: SessionService,
		private alertService: SystemAlertService,
		private authorizationService: AuthorizationService,
		private teamAuthorizationService: TeamAuthorizationService
	) {}

	create(team: Team, firstAdmin?: string): Observable<any> {
		return this.http
			.put(
				`api/team`,
				JSON.stringify({
					team,
					firstAdmin: firstAdmin ? firstAdmin : null
				}),
				{ headers: this.headers }
			)
			.pipe(
				catchError((error: HttpErrorResponse) => {
					this.alertService.addClientErrorAlert(error);
					return of(null);
				})
			);
	}

	get(teamId: string): Observable<Team> {
		return this.http.get(`api/team/${teamId}`).pipe(
			map((result: any) => (null != result ? new Team().setFromModel(result) : null)),
			catchError((error: HttpErrorResponse) => {
				this.alertService.addClientErrorAlert(error);
				return of(null);
			})
		);
	}

	update(id: string, updateData: any): Observable<Team> {
		return this.http
			.post(`api/team/${id}`, JSON.stringify(updateData), { headers: this.headers })
			.pipe(
				map((result: any) => (null != result ? new Team().setFromModel(result) : null)),
				catchError((error: HttpErrorResponse) => {
					this.alertService.addClientErrorAlert(error);
					return of(null);
				})
			);
	}

	search(
		paging: PagingOptions,
		query: any,
		search: string = null,
		options: any
	): Observable<PagingResults<Team>> {
		return this.http
			.post<PagingResults>('api/teams', JSON.stringify({ s: search, q: query, options }), {
				params: paging.toObj(),
				headers: this.headers
			})
			.pipe(
				tap((result: PagingResults) => {
					if (null != result && Array.isArray(result.elements)) {
						result.elements = result.elements.map((element: any) =>
							new Team().setFromModel(element)
						);
					}
				}),
				catchError(() => {
					return of(NULL_PAGING_RESULTS);
				})
			);
	}

	delete(teamId: string): Observable<any> {
		return this.http.delete(`api/team/${teamId}`);
	}

	addMember(teamId: string, memberId: string, role?: string): Observable<any> {
		return this.http.post(`api/team/${teamId}/member/${memberId}`, JSON.stringify({ role }), {
			headers: this.headers
		});
	}

	addMembers(newMembers: AddedMember[], teamId: string): Observable<any> {
		return this.http.put(`api/team/${teamId}/members`, JSON.stringify({ newMembers }), {
			headers: this.headers
		});
	}

	searchMembers(
		team: Team,
		query: any,
		search: any,
		paging: PagingOptions,
		options: any
	): Observable<PagingResults<TeamMember>> {
		return this.http
			.post<PagingResults>(
				`api/team/${team._id}/members?`,
				JSON.stringify({ s: search, q: query, options }),
				{ params: paging.toObj(), headers: this.headers }
			)
			.pipe(
				map((result: PagingResults) => this.handleTeamMembers(result, team)),
				catchError(() => of(NULL_PAGING_RESULTS))
			);
	}

	removeMember(teamId: string, memberId: string): Observable<any> {
		return this.http.delete(`api/team/${teamId}/member/${memberId}`);
	}

	updateMemberRole(teamId: string, memberId: string, role: string): Observable<any> {
		return this.http.post(
			`api/team/${teamId}/member/${memberId}/role`,
			JSON.stringify({ role }),
			{ headers: this.headers }
		);
	}

	getTeams(): Observable<Team[]> {
		return this.search(new PagingOptions(0, 1000), {}, null, {}).pipe(
			map((results: PagingResults) => results.elements),
			catchError(() => of([]))
		);
	}

	getTeamsCanManageResources(): Observable<Team[]> {
		return this.getTeams().pipe(
			map((teams: Team[]) => {
				return teams.filter(
					team =>
						this.authorizationService.isAdmin() ||
						this.teamAuthorizationService.canManageResources(team)
				);
			})
		);
	}

	searchUsers(
		query: any,
		search: string,
		paging: PagingOptions,
		options: any,
		admin = false
	): Observable<PagingResults<User>> {
		const url = admin ? 'api/admin/users' : 'api/users';
		return this.http
			.post<PagingResults>(url, { q: query, s: search, options }, { params: paging.toObj() })
			.pipe(
				tap((results: PagingResults) => {
					if (null != results && Array.isArray(results.elements)) {
						results.elements = results.elements.map((element: any) =>
							new User().setFromUserModel(element)
						);
					}
				}),
				catchError(error => {
					this.alertService.addClientErrorAlert(error);
					return of(NULL_PAGING_RESULTS);
				})
			);
	}

	private handleTeamMembers(result: any, team: Team): PagingResults<TeamMember> {
		if (null != result && Array.isArray(result.elements)) {
			result.elements = result.elements.map((element: any) =>
				new TeamMember().setFromTeamMemberModel(team, element)
			);
		}
		return result;
	}
}
